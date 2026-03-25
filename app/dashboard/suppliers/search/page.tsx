'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, ChevronDown, Plus } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import toast from 'react-hot-toast';

export default function SuppliersSearch() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    companyName: true,
    businessType: false,
    region: false,
    industry: false,
    verificationMethod: false,
    verificationStatus: false,
    trustScore: false,
    expiringSoon: false,
  });

  const [filters, setFilters] = useState({
    businessTypes: [] as string[],
    regions: [] as string[],
    industries: [] as string[],
    verificationMethods: [] as string[],
    verificationStatus: [] as string[],
    trustScoreMin: 0,
    expiringSoon: false,
  });

  const businessTypeOptions = ['Farmer / Producer', 'Manufacturer', 'Distributor', 'Wholesaler', 'Importer', 'Exporter'];
  const regionOptions = ['KwaZulu-Natal', 'Western Cape', 'Gauteng', 'Eastern Cape', 'Free State'];
  const industryOptions = ['Fresh Produce', 'Meat & Poultry', 'Dairy', 'Grains', 'Processed Foods'];
  const verificationMethodOptions = ['Self Upload', 'API Verified', 'Manual Review'];
  const verificationStatusOptions = ['Fully Verified', 'Pending', 'Expiring Soon'];

  useEffect(() => {
    const loadSuppliers = async () => {
      const { data } = await supabase.from('profiles').select('*');
      setSuppliers(data || []);
    };
    loadSuppliers();
  }, []);

  const toggleFilter = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleArrayFilter = (key: string, value: string) => {
    setFilters(prev => {
      const arr = prev[key as keyof typeof prev] as string[];
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
      };
    });
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.legal_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.trading_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pl-[25px]">
      <Breadcrumb />

      <h1 className="text-6xl font-black tracking-tighter text-[#00b4d8]">Search Suppliers</h1>
      <p className="text-2xl text-slate-600 mb-12">Multi-criteria metadata search</p>

      <div className="grid grid-cols-12 gap-8">
        {/* LEFT 1/3 – Invite Supplier */}
        <div className="col-span-12 lg:col-span-4">
          <div className="card h-full p-8 flex flex-col">
            <h3 className="text-3xl font-bold mb-6">Invite New Supplier</h3>
            <p className="text-slate-600 mb-8">Send an invitation to join the verified network.</p>
            
            <input 
              type="email" 
              placeholder="Supplier email address" 
              className="input mb-6"
            />
            
            <button className="btn-primary w-full py-5 flex items-center justify-center gap-3 mt-auto">
              <Plus size={22} /> Send Invitation
            </button>
          </div>
        </div>

        {/* RIGHT 2/3 – ALL 8 Filters in ONE Big Card */}
        <div className="col-span-12 lg:col-span-8">
          <div className="card p-8">
            <div className="flex items-center gap-4 mb-8">
              <Search size={28} />
              <h3 className="text-3xl font-bold">Advanced Metadata Filters</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* 1. Company Name */}
              <div>
                <button onClick={() => toggleFilter('companyName')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Company Name
                  <ChevronDown className={`transition ${expanded.companyName ? 'rotate-180' : ''}`} />
                </button>
                {expanded.companyName && (
                  <div className="relative">
                    <Search className="absolute left-4 top-3.5 text-slate-400" />
                    <input type="text" placeholder="Search companies..." className="input pl-11" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                )}
              </div>

              {/* 2. Business Type */}
              <div>
                <button onClick={() => toggleFilter('businessType')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Business Type
                  <ChevronDown className={`transition ${expanded.businessType ? 'rotate-180' : ''}`} />
                </button>
                {expanded.businessType && (
                  <div className="space-y-3">
                    {businessTypeOptions.map(type => (
                      <label key={type} className="flex items-center gap-3">
                        <input type="checkbox" onChange={() => toggleArrayFilter('businessTypes', type)} />
                        {type}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Region */}
              <div>
                <button onClick={() => toggleFilter('region')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Region
                  <ChevronDown className={`transition ${expanded.region ? 'rotate-180' : ''}`} />
                </button>
                {expanded.region && (
                  <div className="space-y-3">
                    {regionOptions.map(r => (
                      <label key={r} className="flex items-center gap-3">
                        <input type="checkbox" onChange={() => toggleArrayFilter('regions', r)} />
                        {r}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Industry */}
              <div>
                <button onClick={() => toggleFilter('industry')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Industry
                  <ChevronDown className={`transition ${expanded.industry ? 'rotate-180' : ''}`} />
                </button>
                {expanded.industry && (
                  <div className="space-y-3">
                    {industryOptions.map(i => (
                      <label key={i} className="flex items-center gap-3">
                        <input type="checkbox" onChange={() => toggleArrayFilter('industries', i)} />
                        {i}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Verification Method */}
              <div>
                <button onClick={() => toggleFilter('verificationMethod')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Verification Method
                  <ChevronDown className={`transition ${expanded.verificationMethod ? 'rotate-180' : ''}`} />
                </button>
                {expanded.verificationMethod && (
                  <div className="space-y-3">
                    {verificationMethodOptions.map(m => (
                      <label key={m} className="flex items-center gap-3">
                        <input type="checkbox" onChange={() => toggleArrayFilter('verificationMethods', m)} />
                        {m}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 6. Verification Status */}
              <div>
                <button onClick={() => toggleFilter('verificationStatus')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Verification Status
                  <ChevronDown className={`transition ${expanded.verificationStatus ? 'rotate-180' : ''}`} />
                </button>
                {expanded.verificationStatus && (
                  <div className="space-y-3">
                    {verificationStatusOptions.map(s => (
                      <label key={s} className="flex items-center gap-3">
                        <input type="checkbox" onChange={() => toggleArrayFilter('verificationStatus', s)} />
                        {s}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 7. Trust Score */}
              <div>
                <button onClick={() => toggleFilter('trustScore')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Trust Score (Min)
                  <ChevronDown className={`transition ${expanded.trustScore ? 'rotate-180' : ''}`} />
                </button>
                {expanded.trustScore && (
                  <input type="range" min="0" max="100" className="w-full" />
                )}
              </div>

              {/* 8. Expiring Soon */}
              <div>
                <button onClick={() => toggleFilter('expiringSoon')} className="w-full flex justify-between text-lg font-medium mb-4">
                  Expiring Soon
                  <ChevronDown className={`transition ${expanded.expiringSoon ? 'rotate-180' : ''}`} />
                </button>
                {expanded.expiringSoon && (
                  <label className="flex items-center gap-3">
                    <input type="checkbox" onChange={() => setFilters(p => ({...p, expiringSoon: !p.expiringSoon}))} />
                    Show only certificates expiring soon
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mt-12">
        <h3 className="text-2xl font-bold mb-6">Results ({filteredSuppliers.length})</h3>
      </div>
    </div>
  );
}