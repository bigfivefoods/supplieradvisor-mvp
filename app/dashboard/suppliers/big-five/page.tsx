'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Breadcrumb from '@/components/ui/Breadcrumb';

const bigFiveCatalog = [
  { sku: 'BFF-POR-001', name: 'Instant Porridge Mix', category: 'Porridges', unitPrice: 85 },
  { sku: 'BFF-SOY-001', name: 'Soya Mince Family Pack', category: 'Soya Mince', unitPrice: 120 },
  { sku: 'BFF-OPM-001', name: 'One-Pot Meal Starter', category: 'One-Pot Meals', unitPrice: 150 },
  { sku: 'BFF-SUP-001', name: 'Hearty Soup Base', category: 'Soups', unitPrice: 95 },
];

export default function BigFiveOrderingPage() {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const selectedItems = useMemo(
    () =>
      bigFiveCatalog
        .map((item) => ({ ...item, quantity: quantities[item.sku] || 0 }))
        .filter((item) => item.quantity > 0),
    [quantities]
  );

  const total = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [selectedItems]
  );

  const placeOrder = () => {
    if (selectedItems.length === 0) {
      toast.error('Select at least one product to place an order');
      return;
    }

    const lines = selectedItems
      .map((item) => `${item.name} (${item.sku}) x ${item.quantity}`)
      .join('%0A');

    window.open(
      `mailto:orders@bigfivefoods.co.za?subject=Container Spaza Order Request&body=Please process this order:%0A%0A${lines}%0A%0AEstimated total: R${total.toFixed(2)}`,
      '_blank'
    );

    toast.success('Order request opened for Big Five Foods');
  };

  return (
    <div className="pl-0 space-y-8">
      <Breadcrumb />
      <h1 className="text-6xl font-black tracking-tighter text-[#00b4d8]">Big Five Foods Ordering</h1>
      <p className="text-2xl text-slate-600">
        Container Spaza catalog ordering for porridges, soya mince, one-pot meals and soups
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {bigFiveCatalog.map((item) => (
          <div key={item.sku} className="card p-6">
            <div className="text-sm text-[#00b4d8] font-semibold">{item.category}</div>
            <div className="text-xl font-bold mt-1">{item.name}</div>
            <div className="text-slate-600 mt-2">{item.sku}</div>
            <div className="text-lg font-semibold mt-2">R {item.unitPrice.toFixed(2)}</div>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Quantity</label>
              <input
                type="number"
                min="0"
                className="input w-full"
                value={quantities[item.sku] || ''}
                onChange={(e) =>
                  setQuantities((prev) => ({
                    ...prev,
                    [item.sku]: Math.max(0, Number(e.target.value || 0)),
                  }))
                }
                placeholder="0"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="card p-8">
        <h2 className="text-2xl font-bold mb-4">Order Summary</h2>
        {selectedItems.length === 0 ? (
          <p className="text-slate-500">No items selected yet.</p>
        ) : (
          <div className="space-y-3">
            {selectedItems.map((item) => (
              <div key={item.sku} className="flex justify-between">
                <span>{item.name} x {item.quantity}</span>
                <span className="font-medium">R {(item.quantity * item.unitPrice).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t pt-3 mt-3 flex justify-between text-lg font-bold">
              <span>Estimated Total</span>
              <span>R {total.toFixed(2)}</span>
            </div>
          </div>
        )}
        <button onClick={placeOrder} className="btn-primary mt-6">
          Place Order with Big Five Foods
        </button>
      </div>
    </div>
  );
}
