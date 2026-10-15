'use client';

import { usePathname } from 'next/navigation';
import { isRecoverPortalPath } from '@/lib/auth/public-paths';

const REGISTER = `(function(){
  if(!('serviceWorker' in navigator)) return;
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(function(){});
  });
})();`;

/** Install tags for the main site. Portal routes render none of this. */
export default function SiteInstallTags() {
  const path = usePathname() || '/';
  if (isRecoverPortalPath(path)) return null;
  return (
    <>
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="mobile-web-app-capable" content="yes" />
      <link rel="icon" href="/sa-favicon.ico" sizes="any" />
      <script dangerouslySetInnerHTML={{ __html: REGISTER }} />
    </>
  );
}
