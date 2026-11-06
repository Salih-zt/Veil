// @ts-nocheck
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database/db';

export async function GET(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    const db = getDb();
    const session = db.getSession(token);
    if (!session) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const room = db.getRoom(roomId);
    if (!room) {
      return NextResponse.json({ ok: false, message: 'Room not found' }, { status: 404 });
    }

    const isMember = db.isRoomMember(roomId, session.user_id);
    if (!isMember && room.owner_id !== session.user_id) {
      return NextResponse.json({ ok: false, message: 'Access denied: not a member of this room' }, { status: 403 });
    }

    const members = db.getRoomMembers(roomId);
    const capsules = db.listRoomCapsules(roomId);

    return NextResponse.json({
      ok: true,
      room: {
        ...room,
        members,
        capsules,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
