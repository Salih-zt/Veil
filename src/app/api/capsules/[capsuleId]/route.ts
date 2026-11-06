// @ts-nocheck
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database/db';

export async function GET(req: Request, { params }: { params: Promise<{ capsuleId: string }> }) {
  try {
    const { capsuleId } = await params;
    const db = getDb();
    const capsule = db.getCapsuleRecord(capsuleId);

    if (!capsule) {
      return NextResponse.json({ ok: false, message: 'Capsule not found' }, { status: 404 });
    }

    const latestReq = db.getLatestRequestForCapsule(capsuleId);
    const votes = latestReq ? db.getRequestVotes(latestReq.request_id) : [];

    const now = Math.floor(Date.now() / 1000);
    let conditionStatus = 'locked';
    let denialReason = null;

    if (now < capsule.unlock_timestamp) {
      conditionStatus = 'locked_timelock';
      denialReason = `Timelock condition not reached (${capsule.unlock_timestamp - now} seconds remaining)`;
    } else if (votes.length < capsule.approval_threshold) {
      conditionStatus = 'awaiting_approvals';
      denialReason = `Insufficient approvals (${votes.length} of ${capsule.approval_threshold} received)`;
    } else if (now > capsule.expiry_timestamp) {
      conditionStatus = 'expired';
      denialReason = 'Capsule policy has expired';
    } else {
      conditionStatus = 'eligible_for_release';
    }

    return NextResponse.json({
      ok: true,
      capsule: {
        ...capsule,
        conditionStatus,
        denialReason,
        approvalsCount: votes.length,
        votes,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
