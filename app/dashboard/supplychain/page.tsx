'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function SupplyChainPage() {
  const [supplier, setSupplier] = useState('Kelpack');

  const createPO = () => {
    toast.success(`PO created to ${supplier} • Grok has auto-generated BOM and sent to blockchain`);
    // Grok action example
    alert("Grok AI: PO approved. BOM created. Traceability hash generated.");
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-black">Supply Chain • Procurement</h1>
      <p className="text-neutral-600">Order from Kelpack (food) or Packaging World (film)</p>

      <div className="mt-6 flex gap-4">
        <select onChange={e => setSupplier(e.target.value)} className="input">
          <option value="Kelpack">Kelpack (Raw Ingredients)</option>
          <option value="Packaging World">Packaging World (Film)</option>
        </select>
        <button onClick={createPO} className="btn-primary">Create PO + Trigger Grok BOM</button>
      </div>

      <button className="mt-4 bg-black text-white px-6 py-3 rounded-2xl">Ask Grok: “Generate full BOM for this order”</button>
    </div>
  );
}