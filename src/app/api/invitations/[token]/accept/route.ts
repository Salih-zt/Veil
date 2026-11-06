// @ts-nocheck
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database/db';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const authHeader = req.headers.get('authorization') || '';
    const sessionToken = authHeader.replace(/^Bearer\s+/i, '').trim();

    const db = getDb();
    const session = db.getSession(sessionToken);
    if (!session) {
      return NextResponse.json({ ok: false, message: 'Must be authenticated to accept invitations' }, { status: 401 });
    }

    const inv = db.getInvitationByRawToken(token);
    if (!inv) {
      return NextResponse.json({ ok: false, message: 'Invalid or expired invitation' }, { status: 404 });
    }

    db.addRoomMember({
      roomId: inv.room_id,
      userId: session.user_id,
      walletAddress: session.wallet_address,
      role: inv.target_role || 'observer',
    });

    db.markInvitationAccepted(token);

    return NextResponse.json({
      ok: true,
      roomId: inv.room_id,
      role: inv.target_role,
      message: 'Invitation accepted! You have joined the room.',
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
