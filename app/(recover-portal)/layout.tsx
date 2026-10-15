import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'RecoverAdvisor®' },
  description: null,
  keywords: null,
  manifest: null,
  applicationName: 'RecoverAdvisor®',
  authors: null,
  creator: null,
  publisher: null,
  category: null,
  classification: null,
  openGraph: null,
  twitter: null,
  alternates: null,
  robots: 'noindex, nofollow',
  icons: {
    icon: [],
    shortcut: [],
    apple: [],
    other: [],
  },
  // `false` clears web-app metas. An object with capable: false still emits a status-bar style.
  appleWebApp: false,
  other: {
    'apple-mobile-web-app-capable': '',
    'apple-mobile-web-app-status-bar-style': '',
    'mobile-web-app-capable': '',
    'msapplication-TileColor': '',
  },
};

export const viewport: Viewport = {
  themeColor: '#f8fafc',
  colorScheme: 'light',
};

const stripInstallTags = `(function(){
  var metas='meta[name="apple-mobile-web-app-capable"],meta[name="apple-mobile-web-app-status-bar-style"],meta[name="mobile-web-app-capable"]';
  document.querySelectorAll(metas).forEach(function(node){node.remove();});
  document.querySelectorAll('link[rel="manifest"],link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]').forEach(function(node){node.remove();});
  document.querySelectorAll('script').forEach(function(node){
    if(node.textContent&&node.textContent.indexOf('serviceWorker.register')!==-1) node.remove();
  });
  window.addEventListener('load',function(){
    if(!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then(function(regs){
      regs.forEach(function(reg){reg.unregister();});
    }).catch(function(){});
  });
})();`;

export default function RecoverPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: stripInstallTags }} />
      {children}
    </>
  );
}
