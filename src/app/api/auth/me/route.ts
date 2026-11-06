// @ts-nocheck
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database/db';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return NextResponse.json({ ok: false, message: 'Authorization token required' }, { status: 401 });
    }

    const db = getDb();
    const session = db.getSession(token);
    if (!session) {
      return NextResponse.json({ ok: false, message: 'Invalid or expired session' }, { status: 401 });
    }

    const user = db.getUserById(session.user_id);
    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        walletAddress: user.wallet_address,
        email: user.email,
        emailVerified: !!user.email_verified,
        ensName: user.ens_name,
        ensVerified: !!user.ens_verified,
        worldIdVerified: !!user.world_id_verified,
        worldIdNullifier: user.world_id_nullifier,
        createdAt: user.created_at,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
