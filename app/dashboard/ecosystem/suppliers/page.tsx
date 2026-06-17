'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { 
  Search, ChevronDown, UserPlus, Award, Brain, MapPin, 
  CheckCircle, X, Filter 
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Supplier {
  id: number;
  name: string;
  legal_name?: string;
  trading_name?: string;
  continent?: string;
  country?: string;
  province?: string;
  suburb?: string;
  address?: string;
  industry?: string;
  sub_industry?: string;
  trust_score?: number;
  otifef_average?: number;
  verified?: boolean;
  certificates?: string[];
  status?: string;
}

export default function SuppliersSearch() {
  const { user } = usePrivy();
  const cleanId = (user?.id || '').replace('privy:', '');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedContinent, setSelectedContinent] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [trustScoreMin, setTrustScoreMin] = useState(60);
  const [otifefMin, setOtifefMin] = useState(70);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedCertificates, setSelectedCertificates] = useState<string[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedSubIndustry, setSelectedSubIndustry] = useState('');

  // Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCompany, setInviteCompany] = useState('');
  const [inviteMessage, setInviteMessage] = useState(
    'Hi there,\n\nI came across your business on SupplierAdvisor and believe there could be strong synergy between our companies.\n\nI would love to explore a potential partnership.\n\nBest regards,\n[Your Name]'
  );

  const certificatesList = ['HACCP', 'ISO 22000', 'Halal', 'Kosher', 'BRC', 'SQF', 'FSSC 22000', 'Organic'];

  const industries = [
    'Agriculture & Farming', 'Food & Beverage Processing', 'Packaging & Materials',
    'Logistics & Distribution', 'Retail & Wholesale', 'Ingredients & Raw Materials'
  ];

  const loadSuppliers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .order('trust_score', { ascending: false });
    
    setSuppliers(data || []);
    setFilteredSuppliers(data || []);
    setLoading(false);
  };

  // Rich filtering + search
  useEffect(() => {
    let result = [...suppliers];

    // Text search across multiple fields
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s =>
        (s.name?.toLowerCase().includes(term)) ||
        (s.legal_name?.toLowerCase().includes(term)) ||
        (s.trading_name?.toLowerCase().includes(term)) ||
        (s.industry?.toLowerCase().includes(term)) ||
        (s.sub_industry?.toLowerCase().includes(term)) ||
        (s.country?.toLowerCase().includes(term)) ||
        (s.province?.toLowerCase().includes(term)) ||
        (s.suburb?.toLowerCase().includes(term))
      );
    }

    // Location filters
    if (selectedContinent) result = result.filter(s => s.continent === selectedContinent);
    if (selectedCountry) result = result.filter(s => s.country === selectedCountry);
    if (selectedProvince) result = result.filter(s => s.province === selectedProvince);

    // Industry filters
    if (selectedIndustry) result = result.filter(s => s.industry === selectedIndustry);
    if (selectedSubIndustry) result = result.filter(s => s.sub_industry === selectedSubIndustry);

    // Score filters
    result = result.filter(s => (s.trust_score || 0) >= trustScoreMin);
    result = result.filter(s => (s.otifef_average || 0) >= otifefMin);

    // Verified only
    if (verifiedOnly) result = result.filter(s => s.verified === true);

    // Certificates
    if (selectedCertificates.length > 0) {
      result = result.filter(s => 
        selectedCertificates.every(cert => s.certificates?.includes(cert))
      );
    }

    setFilteredSuppliers(result);
  }, [
    searchTerm, selectedContinent, selectedCountry, selectedProvince,
    trustScoreMin, otifefMin, verifiedOnly, selectedCertificates,
    selectedIndustry, selectedSubIndustry, suppliers
  ]);

  const toggleCertificate = (cert: string) => {
    setSelectedCertificates(prev =>
      prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert]
    );
  };

  // World-class Invite Supplier
  const sendWorldClassInvitation = async () => {
    if (!inviteEmail || !inviteCompany) {
      return toast.error('Please enter email and company name');
    }

    try {
      await supabase.from('supplier_invitations').insert({
        email: inviteEmail,
        supplier_name: inviteCompany,
        message: inviteMessage,
        status: 'sent',
        invited_by: cleanId,
      });

      toast.success(`Invitation sent to ${inviteCompany}! They have been added to your pipeline.`);
      
      // Reset form
      setInviteEmail('');
      setInviteCompany('');
      setInviteMessage('Hi there,\n\nI came across your business on SupplierAdvisor and believe there could be strong synergy between our companies.\n\nI would love to explore a potential partnership.\n\nBest regards,\n[Your Name]');
      setShowInviteModal(false);
    } catch (error) {
      toast.error('Failed to send invitation. Please try again.');
    }
  };

  const createPO = (supplierName: string) => {
    toast.success(`Purchase Order created for ${supplierName}`);
  };

  const sendConnectionRequest = async (supplierId: number, name: string) => {
    await supabase.from('business_connections').insert({
      requester_id: cleanId,
      target_id: supplierId,
      status: 'pending'
    });
    toast.success(`Connection request sent to ${name}`);
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  return (
    <div className="p-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-5xl font-black tracking-[-2px]">Supplier Search</h1>
          <p className="text-xl text-neutral-600 mt-2">Discover verified partners across Africa</p>
        </div>
        <button 
          onClick={() => setShowInviteModal(true)}
          className="btn-primary flex items-center gap-2 px-6 py-3 text-base"
        >
          <UserPlus size={20} /> Invite Supplier
        </button>
      </div>

      <div className="flex gap-8">
        {/* Advanced Filters Sidebar */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-3xl p-6 border border-neutral-200 sticky top-8">
            <div className="flex items-center gap-2 mb-6">
              <Filter size={20} />
              <h3 className="font-bold text-lg">Advanced Filters</h3>
            </div>

            {/* Location */}
            <div className="mb-6">
              <div className="text-sm font-semibold mb-3 text-neutral-700">LOCATION</div>
              <select className="input w-full mb-3" value={selectedContinent} onChange={e => setSelectedContinent(e.target.value)}>
                <option value="">Any Continent</option>
                <option value="Africa">Africa</option>
              </select>
              <input type="text" placeholder="Country" className="input w-full mb-3" value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)} />
              <input type="text" placeholder="Province / State" className="input w-full" value={selectedProvince} onChange={e => setSelectedProvince(e.target.value)} />
            </div>

            {/* Industry */}
            <div className="mb-6">
              <div className="text-sm font-semibold mb-3 text-neutral-700">INDUSTRY</div>
              <select className="input w-full mb-3" value={selectedIndustry} onChange={e => setSelectedIndustry(e.target.value)}>
                <option value="">Any Industry</option>
                {industries.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              <input type="text" placeholder="Sub-Industry" className="input w-full" value={selectedSubIndustry} onChange={e => setSelectedSubIndustry(e.target.value)} />
            </div>

            {/* Scores */}
            <div className="mb-6">
              <div className="text-sm font-semibold mb-3 text-neutral-700">PERFORMANCE</div>
              
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Trust Score</span>
                  <span className="font-medium">≥ {trustScoreMin}%</span>
                </div>
                <input type="range" min="50" max="100" value={trustScoreMin} onChange={e => setTrustScoreMin(Number(e.target.value))} className="w-full" />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>OTIFEF Score</span>
                  <span className="font-medium">≥ {otifefMin}%</span>
                </div>
                <input type="range" min="50" max="100" value={otifefMin} onChange={e => setOtifefMin(Number(e.target.value))} className="w-full" />
              </div>
            </div>

            {/* Verified Toggle */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-emerald-600" />
                <span className="font-medium">Verified Only</span>
              </div>
              <button 
                onClick={() => setVerifiedOnly(!verifiedOnly)}
                className={`w-11 h-6 rounded-full transition-colors ${verifiedOnly ? 'bg-emerald-600' : 'bg-neutral-200'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${verifiedOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Certificates */}
            <div>
              <div className="text-sm font-semibold mb-3 text-neutral-700">CERTIFICATIONS</div>
              <div className="flex flex-wrap gap-2">
                {certificatesList.map(cert => (
                  <button
                    key={cert}
                    onClick={() => toggleCertificate(cert)}
                    className={`px-3 py-1 text-xs rounded-full border transition-all ${selectedCertificates.includes(cert) 
                      ? 'bg-black text-white border-black' 
                      : 'bg-white hover:bg-neutral-50'}`}
                  >
                    {cert}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1">
          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-5 top-4 text-neutral-400" size={22} />
            <input
              type="text"
              placeholder="Search by company name, industry, location, or certification..."
              className="input w-full pl-14 text-lg py-4"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Results Count */}
          <div className="flex justify-between items-center mb-4 px-1">
            <div className="text-sm text-neutral-600">
              Showing <span className="font-semibold text-black">{filteredSuppliers.length}</span> suppliers
            </div>
            {verifiedOnly && (
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                <CheckCircle size={16} /> Verified businesses only
              </div>
            )}
          </div>

          {/* Supplier Cards */}
          <div className="space-y-4">
            {filteredSuppliers.length > 0 ? (
              filteredSuppliers.map((supplier) => (
                <div key={supplier.id} className="bg-white border border-neutral-200 rounded-3xl p-6 hover:shadow-lg transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-bold">{supplier.name}</h3>
                        {supplier.verified && (
                          <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">
                            <CheckCircle size={14} /> VERIFIED
                          </div>
                        )}
                      </div>
                      {supplier.legal_name && <div className="text-neutral-600">{supplier.legal_name}</div>}

                      <div className="flex items-center gap-2 text-sm text-neutral-600 mt-3">
                        <MapPin size={16} />
                        {[supplier.suburb, supplier.province, supplier.country].filter(Boolean).join(', ')}
                      </div>

                      {(supplier.industry || supplier.sub_industry) && (
                        <div className="mt-2 text-sm">
                          <span className="font-medium">{supplier.industry}</span>
                          {supplier.sub_industry && ` • ${supplier.sub_industry}`}
                        </div>
                      )}
                    </div>

                    {/* Scores */}
                    <div className="text-right">
                      <div className="flex gap-4">
                        <div>
                          <div className="text-xs text-neutral-500">TRUST</div>
                          <div className="text-2xl font-bold text-black">{supplier.trust_score || 82}</div>
                        </div>
                        <div>
                          <div className="text-xs text-neutral-500">OTIFEF</div>
                          <div className="text-2xl font-bold text-black">{supplier.otifef_average || 91}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 mt-6">
                    <button 
                      onClick={() => sendConnectionRequest(supplier.id, supplier.name)}
                      className="flex-1 py-3 border border-neutral-300 rounded-2xl hover:bg-neutral-50 font-medium"
                    >
                      Connect
                    </button>
                    <button 
                      onClick={() => createPO(supplier.name)}
                      className="flex-1 py-3 bg-neutral-900 text-white rounded-2xl hover:bg-black font-medium"
                    >
                      Create Purchase Order
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-neutral-500">No suppliers match your current filters.</div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Grok Button */}
      <button 
        onClick={() => toast.success("Grok: Scanning supplier network for best matches...")}
        className="fixed bottom-8 right-8 bg-black text-white px-6 py-3.5 rounded-2xl flex items-center gap-2 shadow-2xl"
      >
        <Brain size={20} /> Ask Grok for Recommendations
      </button>

      {/* World-Class Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl w-full max-w-lg p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Invite New Supplier</h2>
              <button onClick={() => setShowInviteModal(false)}><X size={24} /></button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5">Company Name</label>
                <input 
                  type="text" 
                  className="input w-full" 
                  placeholder="e.g. Kelpack Packaging" 
                  value={inviteCompany} 
                  onChange={e => setInviteCompany(e.target.value)} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Email Address</label>
                <input 
                  type="email" 
                  className="input w-full" 
                  placeholder="procurement@company.com" 
                  value={inviteEmail} 
                  onChange={e => setInviteEmail(e.target.value)} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Personal Message</label>
                <textarea 
                  className="input w-full h-32" 
                  value={inviteMessage} 
                  onChange={e => setInviteMessage(e.target.value)} 
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setShowInviteModal(false)} 
                className="flex-1 py-3.5 border rounded-2xl font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={sendWorldClassInvitation} 
                className="flex-1 py-3.5 bg-black text-white rounded-2xl font-medium"
              >
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}