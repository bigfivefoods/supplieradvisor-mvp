import { NextRequest, NextResponse } from 'next/server';
import { getPOEscrowService } from '@/lib/contracts/POEscrowService';

// ==================== POST /api/po ====================
export async function POST(request: NextRequest) {
  try {
    const poEscrowService = getPOEscrowService();
    const body = await request.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing "action" field (create, fund, confirm, release)' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'create':
        result = await poEscrowService.createPO({
          supplier: params.supplier,
          amount: BigInt(params.amount),
          description: params.description,
          deadline: BigInt(params.deadline),
        });
        break;

      case 'fund':
        result = await poEscrowService.fundPO(
          BigInt(params.poId),
          params.amountInEth
        );
        break;

      case 'confirm':
        result = await poEscrowService.confirmDelivery(BigInt(params.poId));
        break;

      case 'release':
        result = await poEscrowService.releaseFunds(BigInt(params.poId));
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
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

// ==================== GET /api/po?id=xx ====================
export async function GET(request: NextRequest) {
  try {
    const poEscrowService = getPOEscrowService();
    const { searchParams } = new URL(request.url);
    const poId = searchParams.get('id');

    if (!poId) {
      const counter = await poEscrowService.getPOCounter();
      return NextResponse.json({
        success: true,
        poCounter: counter.toString(),
      });
    }

    const po = await poEscrowService.getPO(BigInt(poId));
    const status = await poEscrowService.getPOStatus(BigInt(poId));

    return NextResponse.json({
      success: true,
      po: {
        ...po,
        id: po.id.toString(),
        amount: po.amount.toString(),
        fundedAmount: po.fundedAmount.toString(),
        deadline: po.deadline.toString(),
      },
      status,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('PO GET Error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
