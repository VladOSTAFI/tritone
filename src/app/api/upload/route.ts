import { NextRequest, NextResponse } from 'next/server';
import { saveOriginalDocx, writeMeta, readMeta } from '@/lib/storage';
import { convertDocxToPdf } from '@/lib/pdf-converter';

// Force Node.js runtime for filesystem access
export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for conversion

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 15MB in bytes

const VALID_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export async function POST(request: NextRequest) {
  try {
    // Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    // Validation: File exists
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validation: File extension
    if (!file.name.toLowerCase().endsWith('.docx')) {
      return NextResponse.json(
        { error: 'Only .docx files are allowed' },
        { status: 400 }
      );
    }

    // Validation: File size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 15MB' },
        { status: 400 }
      );
    }

    // Validation: MIME type
    if (!VALID_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save file to blob storage
    const savedPath = await saveOriginalDocx(buffer, file.name);

    // Convert DOCX to PDF using the buffer directly (no round trip to storage)
    const conversionResult = await convertDocxToPdf(buffer, file.name);

    // Update meta.json based on conversion result
    const metaToWrite = {
      status: conversionResult.success
        ? ('converted' as const)
        : ('failed' as const),
      createdAt: new Date().toISOString(),
      originalDocxPath: savedPath,
      previewPdfPath: conversionResult.success
        ? conversionResult.pdfPath || null
        : null,
      signedPdfPath: null,
      signatureField: null,
      lastError: conversionResult.success
        ? null
        : conversionResult.error || 'PDF conversion failed',
    };

    // writeMeta returns the written data to avoid eventual consistency issues
    const meta = await writeMeta(metaToWrite);

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      meta,
    });
  } catch (error) {
    console.error('Upload error:', error);

    // Try to update meta with error status
    try {
      const currentMeta = await readMeta();
      await writeMeta({
        ...currentMeta,
        status: 'failed',
        lastError: error instanceof Error ? error.message : 'Upload failed',
      });
    } catch (metaError) {
      console.error('Failed to update meta with error:', metaError);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
