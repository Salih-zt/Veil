// @ts-nocheck
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database/db';
import { decodeFromCarrierText } from '@packages/crypto/codec/wordmap.mjs';
import { toHex } from '@packages/crypto/keys.mjs';

export async function POST(req: Request) {
  try {
    const { carrierText } = await req.json();
    if (!carrierText || typeof carrierText !== 'string') {
      return NextResponse.json({ ok: false, message: 'carrierText required' }, { status: 400 });
    }

    const trimmed = carrierText.trim();
    let bytes: Uint8Array | null = null;
    let decodedHex = '';

    try {
      bytes = decodeFromCarrierText(trimmed);
      decodedHex = '0x' + toHex(bytes);
    } catch (err: any) {
      // If it's a fallback carrier format, check database for matching carrier
      bytes = null;
    }

    const db = getDb();
    // Search DB for capsule matching carrier text
    const stmt = db.prepare('SELECT * FROM capsules WHERE carrier_text = ? LIMIT 1');
    const matched = stmt.get(trimmed);

    if (matched) {
      const fullRecord = db.getCapsuleRecord(matched.capsule_id);
      return NextResponse.json({
        ok: true,
        matchedCapsule: fullRecord,
        decodedHex,
      });
    }

    return NextResponse.json({
      ok: true,
      decodedHex,
      message: 'Carrier text decoded into raw bytes.',
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
