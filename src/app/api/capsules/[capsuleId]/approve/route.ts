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

    const { signature = null, txHash = null } = await req.json();

    const capsule = db.getCapsuleRecord(capsuleId);
    if (!capsule) {
      return NextResponse.json({ ok: false, message: 'Capsule not found' }, { status: 404 });
    }

    // Check if voter is an authorized reviewer
    const isApprover = capsule.approvers.map((a: string) => a.toLowerCase()).includes(session.wallet_address.toLowerCase());
    if (!isApprover) {
      return NextResponse.json({ ok: false, message: 'Caller is not an authorized reviewer for this capsule' }, { status: 403 });
    }

    let releaseReq = db.getLatestRequestForCapsule(capsuleId);
    if (!releaseReq) {
      const rId = 'req_' + Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join('');
      releaseReq = db.createReleaseRequest({
        requestId: rId,
        capsuleId,
        requesterWallet: session.wallet_address,
        requesterEphemeralPubkey: 'auto',
        nonce: 'auto',
        signature: 'auto',
      });
    }

    const votes = db.recordVote({
      requestId: releaseReq.request_id,
      capsuleId,
      voterWallet: session.wallet_address,
      vote: 'approve',
      signature,
      txHash,
    });

    return NextResponse.json({
      ok: true,
      capsuleId,
      approvalsCount: votes.length,
      threshold: capsule.approval_threshold,
      quorumMet: votes.length >= capsule.approval_threshold,
      votes,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
