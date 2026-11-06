// @ts-nocheck
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database/db';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    const db = getDb();
    const session = db.getSession(token);
    if (!session) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    // List user capsules
    const rooms = db.listUserRooms(session.user_id);
    let allCapsules: any[] = [];
    for (const r of rooms) {
      const caps = db.listRoomCapsules(r.id);
      allCapsules = allCapsules.concat(caps);
    }

    return NextResponse.json({ ok: true, capsules: allCapsules });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    const db = getDb();
    const session = db.getSession(token);
    if (!session) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const {
      capsuleId,
      roomId = 'room_default',
      title,
      accessMode = 'named',
      policyHash,
      ciphertextHash,
      ciphertextPayload = '',
      carrierText = '',
      unlockTimestamp,
      expiryTimestamp,
      approvalThreshold = 2,
      guardianThreshold = 2,
      recipients = [],
      approvers = [],
    } = await req.json();

    if (!capsuleId || !title || !policyHash) {
      return NextResponse.json({ ok: false, message: 'capsuleId, title, policyHash required' }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    const unlockTs = unlockTimestamp || now + 60;
    const expiryTs = expiryTimestamp || unlockTs + 86400;

    const capsule = db.createCapsuleRecord({
      capsuleId,
      roomId,
      creatorWallet: session.wallet_address,
      title,
      accessMode,
      policyHash,
      ciphertextHash,
      ciphertextPayload,
      carrierText,
      unlockTimestamp: unlockTs,
      expiryTimestamp: expiryTs,
      approvalThreshold,
      guardianThreshold,
      reviewerCount: approvers.length,
      recipients,
      approvers,
    });

    return NextResponse.json({ ok: true, capsule });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
