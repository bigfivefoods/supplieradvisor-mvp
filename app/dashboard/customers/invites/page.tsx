'use client';

import ComingSoon from '@/components/ComingSoon';

export default function CustomerInvitesPage() {
  return (
    <ComingSoon
      title="Customer Invitations"
      description="Track invitations sent to customers and manage claim status for customer portal access."
      backHref="/dashboard/customers"
      features={[
        'Sent invitation history',
        'Resend and revoke invites',
        'Claim status and onboarding progress',
      ]}
    />
  );
}
