import { NextResponse } from 'next/server';
import { readMeta } from '@/lib/storage';

// Force Node.js runtime for filesystem access
export const runtime = 'nodejs';

export async function GET() {
  try {
    const meta = await readMeta();
    return NextResponse.json(meta);
  } catch (error) {
    console.error('Failed to read meta:', error);
    return NextResponse.json(
      { error: 'Failed to read document status' },
      { status: 500 }
    );
  }
}
