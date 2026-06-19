'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { usePrivy } from '@privy-io/react-auth';
import { Users, UserPlus, Mail } from 'lucide-react';

function TeamContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = usePrivy();
  const cleanId = (user?.id || '').replace('privy:', '');

  const urlCompanyId = searchParams.get('companyId');
  const [companyId, setCompanyId] = useState<string | null>(
    urlCompanyId || localStorage.getItem('selectedCompanyId')
  );

  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);

  const [newTeamMember, setNewTeamMember] = useState({
    name: '',
    email: '',
    role: ''
  });

  // Save companyId to localStorage
  useEffect(() => {
    if (urlCompanyId) {
      localStorage.setItem('selectedCompanyId', urlCompanyId);
      setCompanyId(urlCompanyId);
    }
  }, [urlCompanyId]);

  // Load company + team members
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

  // Invite new team member
  const addTeamMember = async () => {
    if (!newTeamMember.name || !newTeamMember.email) {
      toast.error('Name and Email are required');
      return;
    }
    if (!companyId) {
      toast.error('No company selected');
      return;
    }

    setInviting(true);

    try {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invitation record
      await supabase.from('invitations').insert({
        token,
        profile_id: Number(companyId),
        invited_email: newTeamMember.email,
        invited_by: cleanId,
        role: newTeamMember.role || 'member',
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      });

      // Send invitation email via Edge Function
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

      // Optimistically update UI
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
    } finally {
      setInviting(false);
    }
  };

  // No company selected
  if (!companyId) {
    return (
      <div className="px-4 md:px-8 lg:pr-12 py-12 max-w-md mx-auto text-center">
        <h2 className="text-2xl font-bold mb-4">No Company Selected</h2>
        <p className="text-neutral-600 mb-6">
          Please select a company first to manage your team.
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

  if (loading) {
    return <div className="p-12 text-center">Loading team members...</div>;
  }

  return (
    <div className="px-4 md:px-8 lg:pr-12 py-8 lg:py-12 max-w-screen-2xl mx-auto">
      
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-black text-4xl md:text-5xl tracking-[-2px]">Team &amp; Roles</h1>
        <p className="text-xl text-neutral-600 mt-2">Manage your team members and send invitations</p>
      </div>

      {/* Current Team Members */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-[#00b4d8]/10 rounded-2xl">
            <Users className="w-6 h-6 text-[#00b4d8]" />
          </div>
          <h2 className="text-2xl font-bold">Current Team Members</h2>
        </div>

        {teamMembers.length > 0 ? (
          <div className="space-y-3">
            {teamMembers.map((member, index) => (
              <div 
                key={index} 
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-50 p-5 rounded-2xl"
              >
                <div>
                  <div className="font-semibold text-lg">{member.name}</div>
                  <div className="text-sm text-neutral-500 mt-0.5">
                    {member.email} • {member.role}
                  </div>
                </div>
                <div className="text-xs px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-3xl font-medium self-start md:self-auto">
                  {member.status || 'Active'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-neutral-500">
            No team members added yet. Invite your first team member below.
          </div>
        )}
      </div>

      {/* Invite New Team Member */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-emerald-100 rounded-2xl">
            <UserPlus className="w-6 h-6 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold">Invite New Team Member</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="text-sm font-medium text-neutral-600">Full Name</label>
            <input 
              type="text" 
              className="input w-full mt-1" 
              placeholder="John Doe" 
              value={newTeamMember.name} 
              onChange={e => setNewTeamMember({ ...newTeamMember, name: e.target.value })} 
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-600">Email Address</label>
            <input 
              type="email" 
              className="input w-full mt-1" 
              placeholder="john@company.com" 
              value={newTeamMember.email} 
              onChange={e => setNewTeamMember({ ...newTeamMember, email: e.target.value })} 
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-600">Position / Role</label>
            <select 
              className="input w-full mt-1" 
              value={newTeamMember.role} 
              onChange={e => setNewTeamMember({ ...newTeamMember, role: e.target.value })}
            >
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

        <button 
          onClick={addTeamMember} 
          disabled={inviting}
          className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2 disabled:opacity-70"
        >
          <Mail className="w-5 h-5" />
          {inviting ? 'Sending Invitation...' : 'Add Team Member & Send Invitation Email'}
        </button>
      </div>
    </div>
  );
}

export default function TeamAndRoles() {
  return (
    <Suspense fallback={<div className="p-12 text-center">Loading team...</div>}>
      <TeamContent />
    </Suspense>
  );
}