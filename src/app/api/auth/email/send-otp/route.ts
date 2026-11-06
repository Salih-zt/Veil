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

    const { email } = await req.json();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ ok: false, message: 'Valid email address required' }, { status: 400 });
    }

    const otpBytes = crypto.getRandomValues(new Uint8Array(3));
    const otpNum = ((otpBytes[0] << 16) | (otpBytes[1] << 8) | otpBytes[2]) % 1000000;
    const otp = otpNum.toString().padStart(6, '0');

    db.createEmailToken(email, otp, 10);
    console.log(`[EMAIL DISPATCH] 6-Digit OTP for ${email}: ${otp}`);

    return NextResponse.json({
      ok: true,
      email,
      message: 'Verification code sent (logged to console in development)',
      expiresInMinutes: 10,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
