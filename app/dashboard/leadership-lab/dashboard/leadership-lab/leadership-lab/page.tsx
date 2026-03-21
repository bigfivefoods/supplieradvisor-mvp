'use client';

import Link from 'next/link';
// import InteractiveCube from '@/components/leadership-lab/InteractiveCube';  // we'll add this next

export default function LeadershipLabPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Super-Cube® Leadership Lab</h1>
      <p className="text-lg mb-8">
        Develop the six dimensions of holistic leadership. Proven +28.6% average improvement.
      </p>

      {/* <InteractiveCube />  ← add once ready */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
        <Link href="/dashboard/leadership-lab/assessment" className="btn btn-primary">
          Start Assessment (30 questions)
        </Link>
        <Link href="/dashboard/leadership-lab/modules/heart" className="btn btn-outline">
          Jump to Heart Module
        </Link>
        {/* Add cards/links for each face */}
      </div>
    </div>
  );
}