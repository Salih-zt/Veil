// @ts-nocheck
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database/db';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    const db = getDb();
    const session = db.getSession(token);
    if (!session) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { email, otp } = await req.json();
    if (!email || !otp) {
      return NextResponse.json({ ok: false, message: 'email and otp required' }, { status: 400 });
    }

    const valid = db.verifyEmailToken(email, otp.trim());
    if (!valid) {
      return NextResponse.json({ ok: false, message: 'Invalid or expired OTP code' }, { status: 400 });
    }

    db.updateUserEmail(session.user_id, email, true);
    return NextResponse.json({ ok: true, email, verified: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
