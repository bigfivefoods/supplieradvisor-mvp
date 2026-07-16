import { NextResponse } from 'next/server';
import { getVapidPublicKey, isWebPushConfigured } from '@/lib/push/web-push';

export const dynamic = 'force-dynamic';

/** Public VAPID key for browser PushManager.subscribe */
export async function GET() {
  if (!isWebPushConfigured()) {
    return NextResponse.json({
      success: false,
      configured: false,
      publicKey: null,
      hint: 'Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (and optional VAPID_SUBJECT).',
    });
  }
  return NextResponse.json({
    success: true,
    configured: true,
    publicKey: getVapidPublicKey(),
  });
}
