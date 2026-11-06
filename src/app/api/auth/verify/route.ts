// @ts-nocheck
import { NextResponse } from 'next/server';
import { recoverAddress, hashMessage } from 'viem';
import { getDb } from '@/lib/database/db';

export async function POST(req: Request) {
  try {
    const { address, message, signature } = await req.json();
    if (!address || !message || !signature) {
      return NextResponse.json({ ok: false, message: 'address, message, signature required' }, { status: 400 });
    }

    const db = getDb();
    const storedNonce = db.getValidNonce(address);
    if (!storedNonce) {
      return NextResponse.json({ ok: false, message: 'Expired or invalid challenge nonce. Request a new nonce.' }, { status: 401 });
    }

    if (!message.includes(storedNonce)) {
      return NextResponse.json({ ok: false, message: 'Signed message does not contain current nonce' }, { status: 401 });
    }

    const recovered = await recoverAddress({
      hash: hashMessage(message),
      signature,
    });

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ ok: false, message: 'Cryptographic signature mismatch' }, { status: 401 });
    }

    db.consumeNonce(address);

    let user = db.getUserByWallet(address);
    if (!user) {
      user = db.createUser({ walletAddress: address });
    }

    const tokenBytes = crypto.getRandomValues(new Uint8Array(24));
    const sessionToken = 'veil_sess_' + Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    db.createSession({
      token: sessionToken,
      userId: user.id,
      walletAddress: user.wallet_address,
      durationDays: 7,
    });

    return NextResponse.json({
      ok: true,
      sessionToken,
      user: {
        id: user.id,
        walletAddress: user.wallet_address,
        email: user.email,
        ensName: user.ens_name,
        worldIdVerified: !!user.world_id_verified,
        worldIdNullifier: user.world_id_nullifier,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
