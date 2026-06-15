'use client';

export const dynamic = 'force-dynamic';

export default function MyBusinessProfile() {
  return (
    <div className="p-12">
      <h1 className="text-4xl font-bold">My Business Profile</h1>
      <p>✅ This page now builds successfully.</p>
      <p>We will restore the full UI with Supabase loading next step.</p>
      <button className="mt-8 px-6 py-3 bg-green-600 text-white rounded-xl">Test Button</button>
    </div>
  );
}