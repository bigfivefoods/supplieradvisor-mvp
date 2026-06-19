'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { 
  Settings as SettingsIcon, Bell, Users, 
  Trash2, AlertTriangle, Save 
} from 'lucide-react';

interface CompanySettings {
  companyName: string;
  timezone: string;
  emailNotifications: boolean;
  projectUpdates: boolean;
  teamInvites: boolean;
  marketingEmails: boolean;
}

export default function BusinessSettings() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [settings, setSettings] = useState<CompanySettings>({
    companyName: '',
    timezone: 'Africa/Johannesburg',
    emailNotifications: true,
    projectUpdates: true,
    teamInvites: true,
    marketingEmails: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load settings from Supabase
  useEffect(() => {
    const loadSettings = async () => {
      const storedId = localStorage.getItem('selectedCompanyId');
      if (!storedId) {
        setLoading(false);
        return;
      }

      setCompanyId(storedId);

      const { data: row } = await supabase
        .from('profiles')
        .select('trading_name, settings')
        .eq('id', Number(storedId))
        .single();

      if (row) {
        const savedSettings = row.settings || {};
        
        setSettings({
          companyName: row.trading_name || '',
          timezone: savedSettings.timezone || 'Africa/Johannesburg',
          emailNotifications: savedSettings.emailNotifications ?? true,
          projectUpdates: savedSettings.projectUpdates ?? true,
          teamInvites: savedSettings.teamInvites ?? true,
          marketingEmails: savedSettings.marketingEmails ?? false,
        });
      }

      setLoading(false);
    };

    loadSettings();
  }, []);

  const handleToggle = (key: keyof CompanySettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleInputChange = (key: keyof CompanySettings, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Save settings to Supabase
  const saveSettings = async () => {
    if (!companyId) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          trading_name: settings.companyName,
          settings: {
            timezone: settings.timezone,
            emailNotifications: settings.emailNotifications,
            projectUpdates: settings.projectUpdates,
            teamInvites: settings.teamInvites,
            marketingEmails: settings.marketingEmails,
          }
        })
        .eq('id', Number(companyId));

      if (error) throw error;

      toast.success('Settings saved successfully');
    } catch (error: any) {
      toast.error('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCompany = () => {
    const confirmed = confirm(
      'Are you sure you want to permanently delete this company? This action cannot be undone.'
    );
    
    if (confirmed) {
      toast.error('Company deletion feature coming soon.');
      // TODO: Implement company deletion logic
    }
  };

  if (loading) {
    return <div className="p-12 text-center">Loading settings...</div>;
  }

  if (!companyId) {
    return (
      <div className="p-12 max-w-md mx-auto text-center">
        <h2 className="text-2xl font-bold mb-4">No Company Selected</h2>
        <p className="text-neutral-600 mb-6">Please select a company first.</p>
        <Link href="/dashboard/select-company" className="btn-primary px-8 py-3">
          Select Company
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 lg:pr-12 py-8 lg:py-12 max-w-screen-2xl mx-auto">
      
      {/* Header */}
      <div className="mb-10">
        <Link href="/dashboard/my-business" className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1 mb-2">
          ← Back to My Business
        </Link>
        <h1 className="font-black text-4xl md:text-5xl tracking-[-2px]">Settings</h1>
        <p className="text-xl text-neutral-600 mt-2">Manage your company preferences and configuration</p>
      </div>

      <div className="max-w-4xl space-y-8">
        
        {/* General Settings */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-[#00b4d8]/10 rounded-2xl">
              <SettingsIcon className="w-6 h-6 text-[#00b4d8]" />
            </div>
            <h2 className="text-2xl font-bold">General Settings</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-neutral-600">Company Display Name</label>
              <input 
                type="text" 
                className="input w-full mt-1" 
                value={settings.companyName}
                onChange={(e) => handleInputChange('companyName', e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-600">Timezone</label>
              <select 
                className="input w-full mt-1"
                value={settings.timezone}
                onChange={(e) => handleInputChange('timezone', e.target.value)}
              >
                <option value="Africa/Johannesburg">Africa/Johannesburg (SAST)</option>
                <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-amber-100 rounded-2xl">
              <Bell className="w-6 h-6 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold">Notifications</h2>
          </div>

          <div className="space-y-6">
            {[
              { key: 'emailNotifications' as const, label: 'Email Notifications', desc: 'Receive important updates via email' },
              { key: 'projectUpdates' as const, label: 'Project Updates', desc: 'Get notified when project status changes' },
              { key: 'teamInvites' as const, label: 'Team Invitations', desc: 'Receive alerts when someone joins your team' },
              { key: 'marketingEmails' as const, label: 'Marketing & Product Updates', desc: 'Occasional emails about new features' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-sm text-neutral-500">{desc}</p>
                </div>
                <button
                  onClick={() => handleToggle(key)}
                  className={`w-12 h-7 rounded-full transition-colors ${settings[key] ? 'bg-[#00b4d8]' : 'bg-neutral-200'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Team Permissions */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-100 rounded-2xl">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold">Team Permissions</h2>
          </div>

          <p className="text-neutral-600 mb-4">
            Control what different team members can access and modify.
          </p>

          <Link href="/dashboard/my-business/team" className="inline-flex items-center gap-2 text-[#00b4d8] hover:underline font-medium">
            Manage Team &amp; Roles →
          </Link>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-3xl border border-red-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-red-100 rounded-2xl">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-red-600">Danger Zone</h2>
          </div>

          <div className="space-y-4">
            <div>
              <p className="font-medium text-red-600">Delete Company</p>
              <p className="text-sm text-neutral-600 mt-1">
                Permanently delete this company and all associated data. This action cannot be undone.
              </p>
            </div>

            <button 
              onClick={handleDeleteCompany}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-semibold transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete Company
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button 
            onClick={saveSettings} 
            disabled={saving}
            className="btn-primary px-10 py-4 flex items-center gap-2 disabled:opacity-70"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}