import { NextRequest, NextResponse } from 'next/server';
import { put, head, del } from '@vercel/blob';
import { convertDocxToPdf } from '@/lib/pdf-converter';

// Force Node.js runtime for filesystem access
export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for conversion

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

const VALID_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const DOCX_KEY = 'active/original.docx';
const PREVIEW_PDF_KEY = 'active/preview.pdf';

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
        { error: 'File too large. Maximum size is 5MB' },
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

    // Delete existing DOCX blob if it exists
    try {
      const existing = await head(DOCX_KEY);
      await del(existing.url);
    } catch {
      // Blob doesn't exist, that's fine
    }

    // Save DOCX file to blob storage
    const docxBlob = await put(DOCX_KEY, buffer, {
      access: 'public',
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    // Convert DOCX to PDF using the buffer directly (no round trip to storage)
    const conversionResult = await convertDocxToPdf(buffer, file.name);

    if (!conversionResult.success) {
      return NextResponse.json(
        {
          error: conversionResult.error || 'PDF conversion failed',
          originalDocxUrl: docxBlob.url,
        },
        { status: 500 }
      );
    }

    // Get preview PDF URL from blob storage
    const previewPdfBlob = await head(PREVIEW_PDF_KEY);

    return NextResponse.json({
      success: true,
      message: 'File uploaded and converted successfully',
      originalDocxUrl: docxBlob.url,
      previewPdfUrl: previewPdfBlob.url,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
