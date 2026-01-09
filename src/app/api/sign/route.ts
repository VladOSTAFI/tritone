import { NextRequest, NextResponse } from 'next/server';
import {
  readMeta,
  writeMeta,
  SIGNED_PDF_KEY,
  blobExists,
  getBlobUrl,
} from '@/lib/storage';
import { stampSignatureOnPdf } from '@/lib/pdfStamp';

// Force Node.js runtime for filesystem access
export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for PDF stamping

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { signatureDataUrl } = body;

    // Validation: signatureDataUrl required
    if (!signatureDataUrl || typeof signatureDataUrl !== 'string') {
      return NextResponse.json(
        { error: 'signatureDataUrl is required' },
        { status: 400 }
      );
    }

    // Validation: Must be a valid data URL
    if (!signatureDataUrl.startsWith('data:image/png;base64,')) {
      return NextResponse.json(
        { error: 'signatureDataUrl must be a PNG data URL' },
        { status: 400 }
      );
    }

    // Read current meta
    const meta = await readMeta();

    // Validation: Preview PDF must exist
    if (!meta.previewPdfPath) {
      return NextResponse.json(
        {
          error:
            'Preview PDF not found. Please upload and convert a document first.',
        },
        { status: 400 }
      );
    }

    // Validation: Signature field must be placed
    if (!meta.signatureField) {
      return NextResponse.json(
        {
          error:
            'Signature field not placed. Please place signature field first.',
        },
        { status: 400 }
      );
    }

    // Validation: Document must be converted
    if (meta.status !== 'converted') {
      return NextResponse.json(
        { error: 'Document must be in converted state to sign' },
        { status: 400 }
      );
    }

    // Verify preview PDF exists in blob storage
    const previewExists = await blobExists('active/preview.pdf');
    if (!previewExists) {
      return NextResponse.json(
        { error: 'Preview PDF file not found in storage' },
        { status: 500 }
      );
    }

    // Stamp signature onto PDF
    try {
      await stampSignatureOnPdf(
        meta.previewPdfPath,
        SIGNED_PDF_KEY,
        signatureDataUrl,
        meta.signatureField
      );
    } catch (stampError) {
      console.error('PDF stamping error:', stampError);
      return NextResponse.json(
        {
          error:
            stampError instanceof Error
              ? stampError.message
              : 'Failed to stamp signature on PDF',
        },
        { status: 500 }
      );
    }

    // Get the signed PDF blob URL
    const signedPdfUrl = await getBlobUrl('active/signed.pdf');

    // Update meta: status=signed, signedPdfPath set
    const metaToWrite = {
      ...meta,
      status: 'signed' as const,
      signedPdfPath: signedPdfUrl || SIGNED_PDF_KEY,
    };

    // writeMeta returns the written data to avoid eventual consistency issues
    const updatedMeta = await writeMeta(metaToWrite);

    return NextResponse.json({
      success: true,
      meta: updatedMeta,
    });
  } catch (error) {
    console.error('Signing error:', error);

    // Try to update meta with error status
    try {
      const currentMeta = await readMeta();
      await writeMeta({
        ...currentMeta,
        status: 'failed',
        lastError: error instanceof Error ? error.message : 'Signing failed',
      });
    } catch (metaError) {
      console.error('Failed to update meta with error:', metaError);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Signing failed' },
      { status: 500 }
    );
  }
}
