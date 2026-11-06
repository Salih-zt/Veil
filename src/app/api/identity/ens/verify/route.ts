// @ts-nocheck
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database/db';
import { verifyBidirectionalEns } from '@packages/crypto/identity/ens-resolver.mjs';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    const db = getDb();
    const session = db.getSession(token);
    if (!session) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { ensName } = await req.json();
    if (!ensName || !ensName.endsWith('.eth')) {
      return NextResponse.json({ ok: false, message: 'Valid .eth ENS name required' }, { status: 400 });
    }

    const result = await verifyBidirectionalEns({
      name: ensName,
      address: session.wallet_address,
    });

    if (!result.verified) {
      return NextResponse.json({
        ok: false,
        message: 'ENS bidirectional verification failed: ' + (result.error || 'Forward and reverse parity mismatch'),
        details: result,
      }, { status: 400 });
    }

    db.updateUserEns(session.user_id, ensName, true);

    return NextResponse.json({
      ok: true,
      ensName,
      walletAddress: session.wallet_address,
      bidirectionalMatch: true,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
