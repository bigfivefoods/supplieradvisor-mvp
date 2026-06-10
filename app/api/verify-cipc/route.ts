import { NextRequest, NextResponse } from 'next/server';

/**
 * CIPC Company Verification API
 *
 * For MVP: uses a mock lookup that simulates a CIPC registry response.
 * For production: integrate with the real CIPC e-Services API or a third-party
 * aggregator (e.g. CompanyCheck, OpenCorporates) by replacing the mock logic below.
 *
 * POST /api/verify-cipc
 * Body: { registration_number: string, country?: string }
 * Returns: { success, official_name, status_from_registry, registration_number, verified_at }
 */

interface CIPCResult {
  official_name: string;
  status_from_registry: string;
  registration_number: string;
}

// ---------------------------------------------------------------------------
// Mock CIPC dataset – replace with real API call in production
// ---------------------------------------------------------------------------
const MOCK_REGISTRY: Record<string, CIPCResult> = {
  '2023/123456/07': {
    official_name: 'ACME TRADING (PTY) LTD',
    status_from_registry: 'In Business',
    registration_number: '2023/123456/07',
  },
  '2019/087432/23': {
    official_name: 'GREEN HARVEST COOPERATIVE',
    status_from_registry: 'In Business',
    registration_number: '2019/087432/23',
  },
  '2015/334512/07': {
    official_name: 'BLUE RIDGE LOGISTICS (PTY) LTD',
    status_from_registry: 'In Business',
    registration_number: '2015/334512/07',
  },
};

async function lookupCIPC(registrationNumber: string): Promise<CIPCResult | null> {
  // Normalise: trim whitespace and uppercase
  const normalised = registrationNumber.trim().toUpperCase();

  // --- Replace everything below with a real HTTP call for production ---
  // Example (pseudo-code):
  //   const resp = await fetch(`https://api.cipc.co.za/companies/${encodeURIComponent(normalised)}`, {
  //     headers: { Authorization: `****** },
  //   });
  //   if (!resp.ok) return null;
  //   const json = await resp.json();
  //   return { official_name: json.name, status_from_registry: json.status, registration_number: normalised };
  // ---

  // MVP mock: simulate a network delay
  await new Promise(r => setTimeout(r, 600));

  // Exact match in our mock table
  if (MOCK_REGISTRY[normalised]) return MOCK_REGISTRY[normalised];

  // Fuzzy: strip punctuation and try partial match
  const stripped = normalised.replace(/[^A-Z0-9]/g, '');
  const match = Object.entries(MOCK_REGISTRY).find(([key]) =>
    key.replace(/[^A-Z0-9]/g, '') === stripped
  );
  if (match) return match[1];

  // Simulate "company not found" for invalid numbers
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { registration_number, country = 'South Africa' } = body as {
      registration_number?: string;
      country?: string;
    };

    if (!registration_number || registration_number.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'A valid registration number is required.' },
        { status: 400 }
      );
    }

    // Only CIPC (South Africa) fully supported in MVP; other countries get a
    // "pending manual review" response so the flow still works end-to-end.
    if (country !== 'South Africa') {
      return NextResponse.json({
        success: true,
        verification_status: 'pending',
        official_name: null,
        status_from_registry: 'Manual review required for non-SA registries',
        registration_number: registration_number.trim(),
        verified_at: null,
        message: `Automated verification is not yet available for ${country}. Your registration will be reviewed manually within 2 business days.`,
      });
    }

    const result = await lookupCIPC(registration_number);

    if (!result) {
      return NextResponse.json({
        success: false,
        verification_status: 'failed',
        error: 'Company not found in the CIPC registry. Please check your registration number and try again.',
      });
    }

    return NextResponse.json({
      success: true,
      verification_status: 'verified',
      official_name: result.official_name,
      status_from_registry: result.status_from_registry,
      registration_number: result.registration_number,
      verified_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[verify-cipc]', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}
