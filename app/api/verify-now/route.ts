import { NextRequest, NextResponse } from 'next/server';

const VERIFYNOW_API_KEY = process.env.VERIFYNOW_API_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch('https://www.verifynow.co.za/api/external/verify', {
      method: 'POST',
      headers: {
        'x-api-key': VERIFYNOW_API_KEY,
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    return NextResponse.json(result, { status: response.status });
  } catch (error: any) {
    console.error('VerifyNow API route error:', error);
    return NextResponse.json(
      { error: 'Failed to verify with VerifyNow' },
      { status: 500 }
    );
  }
}