// @ts-nocheck
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database/db';
import { verifyWorldIdProof } from '@packages/crypto/identity/world-id-v2.mjs';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    const db = getDb();
    const session = db.getSession(token);
    if (!session) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { proof } = await req.json();
    if (!proof) {
      return NextResponse.json({ ok: false, message: 'World ID proof required' }, { status: 400 });
    }

    const result = await verifyWorldIdProof(proof, {
      expectedSignal: session.wallet_address,
      appId: process.env.WORLD_ID_APP_ID || 'app_staging_veil_2026',
      action: 'decrypt_capsule',
    });

    if (!result.verified) {
      return NextResponse.json({
        ok: false,
        message: 'World ID verification rejected: ' + (result.reason || 'Invalid Groth16 proof vector'),
      }, { status: 400 });
    }

    db.updateUserWorldId(session.user_id, result.nullifier, true);

    return NextResponse.json({
      ok: true,
      verified: true,
      nullifier: result.nullifier,
      mode: result.mode,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
