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

    const rooms = db.listUserRooms(session.user_id);
    return NextResponse.json({ ok: true, rooms });
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

    const { name, description } = await req.json();
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ ok: false, message: 'Room name required' }, { status: 400 });
    }

    const roomBytes = crypto.getRandomValues(new Uint8Array(12));
    const roomId = 'room_' + Array.from(roomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    const room = db.createRoom({
      id: roomId,
      name,
      description: description || '',
      ownerId: session.user_id,
      ownerAddress: session.wallet_address,
    });

    return NextResponse.json({ ok: true, room });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
