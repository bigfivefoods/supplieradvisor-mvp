'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { usePrivy } from '@privy-io/react-auth';

function TeamContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = usePrivy();
  const cleanId = (user?.id || '').replace('privy:', '');

  // Support both URL param and localStorage (common pattern)
  const urlCompanyId = searchParams.get('companyId');
  const [companyId, setCompanyId] = useState<string | null>(urlCompanyId || localStorage.getItem('selectedCompanyId'));

  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);

  const [newTeamMember, setNewTeamMember] = useState({
    name: '',
    email: '',
    role: ''
  });

  useEffect(() => {
    // Save to localStorage if we got it from URL
    if (urlCompanyId) {
      localStorage.setItem('selectedCompanyId', urlCompanyId);
      setCompanyId(urlCompanyId);
    }
  }, [urlCompanyId]);

  useEffect(() => {
    const loadData = async () => {
      if (!companyId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      // Load company name
      const { data: company } = await supabase
        .from('profiles')
        .select('trading_name, legal_name')
        .eq('id', Number(companyId))
        .single();

      if (company) {
        setCompanyName(company.trading_name || company.legal_name || 'Your Company');
      }

      // Load team members
      const { data: members } = await supabase
        .from('business_users')
        .select('*')
        .eq('profile_id', Number(companyId))
        .order('created_at', { ascending: false });

      if (members) setTeamMembers(members);
      setLoading(false);
    };

    loadData();
  }, [companyId]);

  const addTeamMember = async () => {
    if (!newTeamMember.name || !newTeamMember.email) {
      toast.error('Name and Email are required');
      return;
    }
    if (!companyId) {
      toast.error('No company selected');
      return;
    }

    try {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await supabase.from('invitations').insert({
        token,
        profile_id: Number(companyId),
        invited_email: newTeamMember.email,
        invited_by: cleanId,
        role: newTeamMember.role || 'member',
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      });

      await supabase.functions.invoke('send-team-invitation', {
        body: {
          to_email: newTeamMember.email,
          to_name: newTeamMember.name,
          company_name: companyName,
          role: newTeamMember.role || 'Team Member',
          inviter_name: 'The team',
          token,
        },
      });

      toast.success(`✅ Invitation sent to ${newTeamMember.email}`);

      const memberData = {
        profile_id: Number(companyId),
        name: newTeamMember.name,
        email: newTeamMember.email,
        role: newTeamMember.role || 'Other',
        status: 'invited',
        invited_at: new Date().toISOString()
      };

      setTeamMembers(prev => [memberData, ...prev]);
      setNewTeamMember({ name: '', email: '', role: '' });
    } catch (err) {
      console.error(err);
      toast.error('Failed to send invitation');
    }
  };

  // No company selected screen
  if (!companyId) {
    return (
      <div className="p-12 max-w-md mx-auto text-center">
        <h2 className="text-2xl font-bold mb-4">No Company Selected</h2>
        <p className="text-neutral-600 mb-6">
          Please select a company first to manage team members.
        </p>
        <button 
          onClick={() => router.push('/dashboard/select-company')}
          className="btn-primary px-8 py-3"
        >
          Select Company
        </button>
      </div>
    );
  }

  if (loading) return <div className="p-12">Loading team...</div>;

  return (
    <div className="p-8 max-w-screen-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-black text-5xl tracking-tight">Team & Roles</h1>
        <p className="text-xl text-neutral-600 mt-1">Manage your team members and send invitations</p>
      </div>

      {/* Current Team Members */}
      <div className="bg-white rounded-3xl p-8 border border-neutral-200 mb-8">
        <h2 className="text-2xl font-bold mb-6">Current Team Members</h2>

        {teamMembers.length > 0 ? (
          <div className="space-y-3">
            {teamMembers.map((member, index) => (
              <div key={index} className="flex justify-between items-center bg-neutral-50 p-5 rounded-2xl">
                <div>
                  <div className="font-medium">{member.name}</div>
                  <div className="text-sm text-neutral-500">{member.email} • {member.role}</div>
                </div>
                <div className="text-xs px-4 py-1 bg-emerald-100 text-emerald-700 rounded-3xl">
                  {member.status || 'Active'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-neutral-500">No team members added yet.</p>
        )}
      </div>

      {/* Invite New Team Member */}
      <div className="bg-white rounded-3xl p-8 border border-neutral-200">
        <h2 className="text-2xl font-bold mb-6">Invite New Team Member</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="text-sm font-medium">Full Name</label>
            <input type="text" className="input w-full mt-1" placeholder="John Doe" value={newTeamMember.name} onChange={e => setNewTeamMember({ ...newTeamMember, name: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Email Address</label>
            <input type="email" className="input w-full mt-1" placeholder="john@company.com" value={newTeamMember.email} onChange={e => setNewTeamMember({ ...newTeamMember, email: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Position / Role</label>
            <select className="input w-full mt-1" value={newTeamMember.role} onChange={e => setNewTeamMember({ ...newTeamMember, role: e.target.value })}>
              <option value="">Select Position</option>
              <option value="CEO">CEO / Managing Director</option>
              <option value="Director">Director</option>
              <option value="Manager">Manager</option>
              <option value="Operations">Operations Lead</option>
              <option value="Finance">Finance Lead</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <button onClick={addTeamMember} className="btn-primary w-full py-4 text-lg">
          Add Team Member & Send Invitation Email
        </button>
      </div>
    </div>
  );
}

export default function TeamAndRoles() {
  return (
    <Suspense fallback={<div className="p-12">Loading...</div>}>
      <TeamContent />
    </Suspense>
  );
}