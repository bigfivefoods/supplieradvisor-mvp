import { Suspense } from 'react';
import OnboardingContent from './OnboardingContent';

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00b4d8] mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading onboarding form...</p>
        </div>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}