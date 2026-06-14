'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';

type Business = {
  id: string;
  name: string;
  type?: string;
  suburb?: string;
  containerId?: string;
};

export default function SelectCompany() {
  const { user } = usePrivy();
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([
    { id: '1', name: 'Test Container Spaza', type: 'ContainerSpaza', suburb: 'Umlazi' },
    { id: '2', name: 'Big Five Foods', type: 'Main', suburb: 'Durban' },
    { id: '3', name: 'BFFK', type: 'ContainerSpaza', suburb: 'KwaDukuza' },
    { id: '4', name: 'EVERWAVE', type: 'Business', suburb: 'Howick' },
    { id: '5', name: 'VUKA', type: 'Main', suburb: 'Pietermaritzburg' },
    // Add more from your list if needed
  ]);

  const handleSelect = (b: Business) => {
    localStorage.setItem('selectedBusinessId', b.id);
    router.push(`/dashboard/profile?businessId=${b.id}`);
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Select Your Company (All loaded)</h1>
      <div className="grid gap-4">
        {businesses.map(b => (
          <div key={b.id} className="p-6 border rounded-xl cursor-pointer hover:bg-gray-50" onClick={() => handleSelect(b)}>
            <h2>{b.name}</h2>
            <p>{b.type} - {b.suburb}</p>
            <button className="mt-3 bg-blue-600 text-white px-6 py-2 rounded">Select</button>
          </div>
        ))}
      </div>
      <button onClick={() => window.location.reload()} className="mt-6 bg-green-600 text-white px-6 py-2">Refresh List</button>
    </div>
  );
}