'use client';

import ModuleHub from '@/components/ModuleHub';
import HubCard from '@/components/HubCard';
import { 
  Building2, 
  Users, 
  FolderOpen, 
  ShieldCheck, 
  FileText, 
  Settings 
} from 'lucide-react';

export default function MyBusinessHub() {
  return (
    <ModuleHub
      title="My Business"
      description="Manage your company profile, team, projects, legal structure, documents, and business settings."
      backHref="/dashboard"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <HubCard
          title="Company Profile"
          description="View and update your business details, branding, and public information."
          href="/dashboard/my-business/profile"
          icon={Building2}
        />

        <HubCard
          title="Team & Roles"
          description="Manage team members, roles, permissions, and access levels."
          href="/dashboard/my-business/team"
          icon={Users}
        />

        <HubCard
          title="Projects"
          description="Track strategic projects, initiatives, and key business activities."
          href="/dashboard/my-business/projects"
          icon={FolderOpen}
        />

        <HubCard
          title="Legal & Compliance"
          description="Manage company registration, B-BBEE, tax, and regulatory documents."
          href="/dashboard/my-business/legal"
          icon={ShieldCheck}
        />

        <HubCard
          title="Documents"
          description="Store and access important business documents and contracts."
          href="/dashboard/my-business/documents"
          icon={FileText}
        />

        <HubCard
          title="Settings"
          description="Configure business preferences, notifications, and system defaults."
          href="/dashboard/my-business/settings"
          icon={Settings}
        />

      </div>
    </ModuleHub>
  );
}