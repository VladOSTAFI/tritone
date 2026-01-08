import { NextResponse } from 'next/server';
import { clearActiveDocument, readMeta } from '@/lib/storage';

export async function POST() {
  try {
    // Clear all document data
    await clearActiveDocument();

    // Read the reset meta to return to client
    const meta = await readMeta();

    return NextResponse.json({
      success: true,
      meta,
      message: 'Document data cleared successfully',
    });
  } catch (error) {
    console.error('Clear error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to clear document data',
      },
      { status: 500 }
    );
  }
}
