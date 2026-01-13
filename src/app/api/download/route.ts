import { NextRequest, NextResponse } from 'next/server';
import { head } from '@vercel/blob';

// Force Node.js runtime for blob storage access
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

    // Get the appropriate PDF blob key based on type
    const blobKey = type === 'preview' ? 'active/preview.pdf' : 'active/signed.pdf';

    // Get blob URL
    let blobUrl: string;
    try {
      const blob = await head(blobKey);
      blobUrl = blob.url;
    } catch {
      const message =
        type === 'preview'
          ? 'Preview PDF not available. Please upload and convert a document first.'
          : 'Signed PDF not available. Please sign the document first.';
      return NextResponse.json({ error: message }, { status: 404 });
    }

    // Fetch the blob content
    const response = await fetch(blobUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch PDF from storage` },
        { status: 500 }
      );
    }

    // Get the blob as a stream
    const blob = await response.blob();
    const stream = blob.stream();

    // Return PDF with appropriate headers
    return new Response(stream, {
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
