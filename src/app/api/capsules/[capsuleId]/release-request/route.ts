// @ts-nocheck
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database/db';

export async function POST(req: Request, { params }: { params: Promise<{ capsuleId: string }> }) {
  try {
    const { capsuleId } = await params;
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    const db = getDb();
    const session = db.getSession(token);
    if (!session) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { ephemeralPubkey, nonce, signature, worldIdNullifier } = await req.json();

    const capsule = db.getCapsuleRecord(capsuleId);
    if (!capsule) {
      return NextResponse.json({ ok: false, message: 'Capsule not found' }, { status: 404 });
    }

    // If named recipient, check caller wallet
    if (capsule.access_mode === 'named') {
      const allowed = capsule.recipients.map((r: string) => r.toLowerCase()).includes(session.wallet_address.toLowerCase());
      if (!allowed) {
        return NextResponse.json({ ok: false, message: 'Unauthorized recipient for named capsule' }, { status: 403 });
      }
    }

    const reqId = 'req_' + Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join('');

    const releaseReq = db.createReleaseRequest({
      requestId: reqId,
      capsuleId,
      requesterWallet: session.wallet_address,
      requesterEns: session.user?.ens_name || null,
      requesterEphemeralPubkey: ephemeralPubkey || 'ephemeral_pubkey',
      nonce: nonce || 'nonce',
      signature: signature || 'signature',
      worldIdNullifier: worldIdNullifier || session.user?.world_id_nullifier || null,
    });

    return NextResponse.json({ ok: true, request: releaseReq });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
