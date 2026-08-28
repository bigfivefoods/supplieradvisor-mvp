import { NextRequest } from 'next/server';
import { runHealthOps } from '../ops-probe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return runHealthOps(request);
}
