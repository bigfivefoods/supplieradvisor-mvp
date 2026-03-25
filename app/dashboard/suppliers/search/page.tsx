'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, ChevronDown } from 'lucide-react';
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

  const filteredSuppliers = suppliers.filter(s => {
    const matchesName = s.legal_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                       s.trading_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesName;
  });

  return (
    <div className="pl-[25px]">
      <Breadcrumb />

      <h1 className="text-6xl font-black tracking-tighter text-[#00b4d8]">Search Suppliers</h1>
      <p className="text-2xl text-slate-600 mb-12">Multi-criteria metadata search with expandable tickboxes</p>

      {/* Main Search Bar */}
      <div className="card p-8 mb-12">
        <div className="relative">
          <Search className="absolute left-6 top-5 text-slate-400" size={24} />
          <input
            type="text"
            placeholder="Search by company name..."
            className="input pl-16 text-lg"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Metadata Filters – ALL expandable with multi-select tickboxes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Company Name */}
        <div className="card">
          <button onClick={() => toggleFilter('companyName')} className="w-full flex justify-between text-lg font-medium mb-4">
            Company Name
            <ChevronDown className={`transition ${expanded.companyName ? 'rotate-180' : ''}`} />
          </button>
          {expanded.companyName && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-3 text-slate-400" />
                <input type="text" placeholder="Search companies..." className="input pl-11" />
              </div>
            </div>
          )}
        </div>

        {/* Business Type */}
        <div className="card">
          <button onClick={() => toggleFilter('businessType')} className="w-full flex justify-between text-lg font-medium mb-4">
            Business Type
            <ChevronDown className={`transition ${expanded.businessType ? 'rotate-180' : ''}`} />
          </button>
          {expanded.businessType && (
            <div className="space-y-3">
              {businessTypeOptions.map(type => (
                <label key={type} className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    onChange={() => toggleArrayFilter('businessTypes', type)} 
                  />
                  {type}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Region */}
        <div className="card">
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

        {/* Industry */}
        <div className="card">
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

        {/* Verification Method */}
        <div className="card">
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

        {/* Verification Status */}
        <div className="card">
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

        {/* Trust Score */}
        <div className="card">
          <button onClick={() => toggleFilter('trustScore')} className="w-full flex justify-between text-lg font-medium mb-4">
            Trust Score (Min)
            <ChevronDown className={`transition ${expanded.trustScore ? 'rotate-180' : ''}`} />
          </button>
          {expanded.trustScore && (
            <div className="space-y-3">
              <input type="range" min="0" max="100" className="w-full" />
            </div>
          )}
        </div>

        {/* Expiring Soon */}
        <div className="card">
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

      {/* Results */}
      <div className="mt-12">
        <h3 className="text-2xl font-bold mb-6">Results ({filteredSuppliers.length})</h3>
        {/* Results grid would go here */}
      </div>
    </div>
  );
}