import { NextResponse } from 'next/server';
import { list, del } from '@vercel/blob';

export async function POST() {
  try {
    // List all blobs with 'active/' prefix
    const { blobs } = await list({ prefix: 'active/' });

    // Delete all blobs in the active directory
    await Promise.all(blobs.map((blob) => del(blob.url).catch(() => {})));

    return NextResponse.json({
      success: true,
      message: 'All files cleared successfully',
    });
  } catch (error) {
    console.error('Clear error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to clear files',
      },
      { status: 500 }
    );
  }
}
