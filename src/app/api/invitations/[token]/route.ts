// @ts-nocheck
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database/db';

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const db = getDb();
    const inv = db.getInvitationByRawToken(token);

    if (!inv) {
      return NextResponse.json({ ok: false, message: 'Invalid or expired invitation token' }, { status: 404 });
    }

    const room = db.getRoom(inv.room_id);
    return NextResponse.json({
      ok: true,
      invitation: {
        roomId: inv.room_id,
        roomName: room ? room.name : 'Unknown Room',
        inviterAddress: inv.inviter_address,
        targetEmail: inv.target_email,
        targetRole: inv.target_role,
        status: inv.status,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
