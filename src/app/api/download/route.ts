import { NextRequest, NextResponse } from 'next/server';
import { readMeta } from '@/lib/storage';
import fs from 'fs';
import { Readable } from 'stream';

// Force Node.js runtime for filesystem access
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameter
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');

    // Validate type parameter
    if (!type) {
      return NextResponse.json(
        { error: 'Type parameter required. Use ?type=preview or ?type=signed' },
        { status: 400 }
      );
    }

    if (type !== 'preview' && type !== 'signed') {
      return NextResponse.json(
        { error: 'Invalid type parameter. Must be "preview" or "signed"' },
        { status: 400 }
      );
    }

    // Read metadata to get file path
    const meta = await readMeta();

    // Get the appropriate PDF path based on type
    const pdfPath =
      type === 'preview' ? meta.previewPdfPath : meta.signedPdfPath;

    if (!pdfPath) {
      const message =
        type === 'preview'
          ? 'Preview PDF not available. Please upload and convert a document first.'
          : 'Signed PDF not available. Please sign the document first.';
      return NextResponse.json({ error: message }, { status: 404 });
    }

    // Check if file exists
    try {
      await fs.promises.access(pdfPath);
    } catch {
      return NextResponse.json(
        { error: `PDF file not found at expected path` },
        { status: 500 }
      );
    }

    // Create read stream
    const fileStream = fs.createReadStream(pdfPath);

    // Convert Node.js stream to Web Stream
    const webStream = Readable.toWeb(fileStream) as ReadableStream;

    // Return PDF with appropriate headers
    return new Response(webStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${type}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Download failed' },
      { status: 500 }
    );
  }
}
