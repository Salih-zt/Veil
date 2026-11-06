// @ts-nocheck
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database/db';

export async function POST(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
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

    const { email, role = 'observer' } = await req.json();

    const rawTokenBytes = crypto.getRandomValues(new Uint8Array(24));
    const rawToken = Array.from(rawTokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    db.createRoomInvitation({
      roomId,
      inviterAddress: session.wallet_address,
      targetEmail: email || null,
      targetRole: role,
      rawToken,
      expiresInDays: 7,
    });

    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const inviteLink = `${origin}/invite/${rawToken}`;

    if (email) {
      console.log(`[EMAIL DISPATCH] Room Invitation for ${email}: ${inviteLink}`);
    }

    return NextResponse.json({
      ok: true,
      inviteLink,
      rawToken,
      role,
      expiresInDays: 7,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
