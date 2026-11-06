// @ts-nocheck
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database/db';

export async function GET(req: Request, { params }: { params: Promise<{ receiptId: string }> }) {
  try {
    const { receiptId } = await params;
    const db = getDb();
    const receipt = db.getDisclosureReceipt(receiptId);

    if (!receipt) {
      return NextResponse.json({ ok: false, message: 'Receipt not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, receipt });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
