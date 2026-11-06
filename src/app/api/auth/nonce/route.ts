// @ts-nocheck
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database/db';

export async function POST(req: Request) {
  try {
    const { address } = await req.json();
    if (!address || typeof address !== 'string' || !address.startsWith('0x')) {
      return NextResponse.json({ ok: false, message: 'Valid Ethereum address required' }, { status: 400 });
    }

    const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
    const nonce = 'veil_nonce_' + Array.from(nonceBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    const db = getDb();
    db.saveNonce(address, nonce);

    return NextResponse.json({
      ok: true,
      address: address.toLowerCase(),
      nonce,
      issuedAt: new Date().toISOString(),
      expiresIn: 300,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
