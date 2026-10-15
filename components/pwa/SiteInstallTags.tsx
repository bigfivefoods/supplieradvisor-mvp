'use client';

import { usePathname } from 'next/navigation';
import { isRecoverPortalPath } from '@/lib/auth/public-paths';

const REGISTER = `(function(){
  if(!('serviceWorker' in navigator)) return;
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(function(){});
  });
})();`;

function hidesSiteInstallTags(path: string) {
  return (
    isRecoverPortalPath(path) ||
    path === '/work/recovergraph' ||
    path.startsWith('/work/recovergraph/') ||
    path.startsWith('/crew/recovergraph') ||
    path.startsWith('/customer/recovergraph')
  );
}

/**
 * Marketing-site install tags.
 * The script registers /sw.js with scope "/", the same origin-wide scope as public/sw.js.
 * Portal routes and RecoverAdvisor® app shells skip these tags, so those documents do not register the worker.
 */
export default function SiteInstallTags() {
  const path = usePathname() || '/';
  if (hidesSiteInstallTags(path)) return null;
  return (
    <>
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="mobile-web-app-capable" content="yes" />
      <script dangerouslySetInnerHTML={{ __html: REGISTER }} />
    </>
  );
}
