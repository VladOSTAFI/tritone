import { NextRequest, NextResponse } from 'next/server';
import { head } from '@vercel/blob';
import { stampSignatureOnPdf } from '@/lib/pdfStamp';
import type { SignatureField } from '@/lib/types';

// Force Node.js runtime for filesystem access
export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for PDF stamping

const PREVIEW_PDF_KEY = 'active/preview.pdf';
const SIGNED_PDF_KEY = 'active/signed.pdf';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { signatureDataUrl, signatureField } = body as {
      signatureDataUrl: string;
      signatureField: SignatureField;
    };

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

    // Validation: Signature field must be provided
    if (!signatureField) {
      return NextResponse.json(
        { error: 'signatureField is required' },
        { status: 400 }
      );
    }

    // Validate signature field structure
    const { page, xN, yN, wN, hN } = signatureField;
    if (
      typeof page !== 'number' ||
      typeof xN !== 'number' ||
      typeof yN !== 'number' ||
      typeof wN !== 'number' ||
      typeof hN !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Invalid signature field data' },
        { status: 400 }
      );
    }

    // Verify preview PDF exists in blob storage
    let previewPdfUrl: string;
    try {
      const previewPdfBlob = await head(PREVIEW_PDF_KEY);
      previewPdfUrl = previewPdfBlob.url;
    } catch {
      return NextResponse.json(
        { error: 'Preview PDF file not found in storage' },
        { status: 404 }
      );
    }

    // Stamp signature onto PDF
    try {
      await stampSignatureOnPdf(
        previewPdfUrl,
        SIGNED_PDF_KEY,
        signatureDataUrl,
        signatureField
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
    const signedPdfBlob = await head(SIGNED_PDF_KEY);

    return NextResponse.json({
      success: true,
      signedPdfUrl: signedPdfBlob.url,
    });
  } catch (error) {
    console.error('Signing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Signing failed' },
      { status: 500 }
    );
  }
}
