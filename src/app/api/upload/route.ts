import { NextRequest, NextResponse } from 'next/server';
import { saveOriginalDocx, writeMeta, readMeta } from '@/lib/storage';

// Force Node.js runtime for filesystem access
export const runtime = 'nodejs';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB in bytes

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
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save file to filesystem
    const savedPath = await saveOriginalDocx(buffer, file.name);

    // Update meta.json
    const meta = {
      status: 'uploaded' as const,
      createdAt: new Date().toISOString(),
      originalDocxPath: savedPath,
      previewPdfPath: null,
      signedPdfPath: null,
      signatureField: null,
      lastError: null,
    };
    await writeMeta(meta);

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
