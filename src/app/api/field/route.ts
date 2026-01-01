import { NextRequest, NextResponse } from 'next/server';
import { readMeta, writeMeta } from '@/lib/storage';
import type { SignatureField } from '@/lib/types';

// Force Node.js runtime for filesystem access
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { page, xN, yN, wN, hN } = body as SignatureField;

    // Validation: All fields required
    if (
      typeof page !== 'number' ||
      typeof xN !== 'number' ||
      typeof yN !== 'number' ||
      typeof wN !== 'number' ||
      typeof hN !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Invalid signature field data. All fields (page, xN, yN, wN, hN) are required.' },
        { status: 400 }
      );
    }

    // Validation: Normalized coordinates must be 0-1
    if (xN < 0 || xN > 1 || yN < 0 || yN > 1 || wN <= 0 || wN > 1 || hN <= 0 || hN > 1) {
      return NextResponse.json({ error: 'Normalized coordinates must be between 0 and 1' }, { status: 400 });
    }

    // Validation: Page must be positive integer
    if (page < 1 || !Number.isInteger(page)) {
      return NextResponse.json({ error: 'Page number must be a positive integer' }, { status: 400 });
    }

    // Read current meta
    const meta = await readMeta();

    // Validation: Document must be converted
    if (meta.status !== 'converted') {
      return NextResponse.json(
        { error: 'Document must be converted before placing signature field' },
        { status: 400 }
      );
    }

    // Update meta with signature field
    const updatedMeta = {
      ...meta,
      signatureField: { page, xN, yN, wN, hN },
    };

    await writeMeta(updatedMeta);

    return NextResponse.json({
      success: true,
      meta: updatedMeta,
    });
  } catch (error) {
    console.error('Field placement error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save signature field' },
      { status: 500 }
    );
  }
}
