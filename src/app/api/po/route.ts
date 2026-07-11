import { NextRequest, NextResponse } from 'next/server';
import { getPOEscrowService } from '@/lib/contracts/POEscrowService';

/**
 * Legacy admin/script API for POEscrowV2 (server private key).
 * Prefer client-signed flows on /dashboard/suppliers/po and /dashboard/buyer/pos.
 */
export async function POST(request: NextRequest) {
  try {
    const poEscrowService = getPOEscrowService();
    const body = await request.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json(
        {
          error:
            'Missing "action" field (create, fund, ship, confirm, release)',
        },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'create':
        result = await poEscrowService.createPO({
          supplier: params.supplier,
          amount: BigInt(params.amount),
          metadataURI:
            params.metadataURI ||
            params.description ||
            `po://legacy/${Date.now()}`,
        });
        break;

      case 'fund':
        result = await poEscrowService.fundPO(
          BigInt(params.poId),
          params.amountInEth
        );
        break;

      case 'ship':
        result = await poEscrowService.markShipped(BigInt(params.poId));
        break;

      case 'confirm':
      case 'release':
        result = await poEscrowService.confirmDelivery(BigInt(params.poId));
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      transactionHash: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('PO API Error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const poEscrowService = getPOEscrowService();
    const { searchParams } = new URL(request.url);
    const poId = searchParams.get('id');

    if (!poId) {
      return NextResponse.json({
        success: true,
        hint: 'Pass ?id= for getPO. Counter not exposed on Hardhat POEscrowV2 ABI as getPOCounter.',
      });
    }

    const po = await poEscrowService.getPO(BigInt(poId));
    // getPO returns struct tuple / object depending on ABI encoding
    if (Array.isArray(po)) {
      const row = po as readonly unknown[];
      return NextResponse.json({
        success: true,
        po: {
          id: String(row[0]),
          buyer: row[1],
          supplier: row[2],
          amount: String(row[3]),
          metadataURI: row[4],
          status: row[5],
          createdAt: row[6] != null ? String(row[6]) : null,
          fundedAt: row[7] != null ? String(row[7]) : null,
        },
      });
    }

    const obj = (po && typeof po === 'object' ? po : {}) as Record<string, unknown>;
    return NextResponse.json({
      success: true,
      po: {
        ...obj,
        id: obj.id != null ? String(obj.id) : undefined,
        amount: obj.amount != null ? String(obj.amount) : undefined,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('PO GET Error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
