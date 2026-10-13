/**
 * Fixture fetch gate. Same-origin GET /api/* is answered from memory.
 * Any other method is rejected in the browser and never reaches a database.
 * Third-party URLs that merely contain "/api/" (Privy, wallets) are left alone.
 */
import { previewJson } from '@/lib/preview/os-fixtures';

const WRITE_BODY = {
  error: 'Sample book only — nothing was saved on SupplierAdvisor®',
};

function isSameOriginApi(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

/** Public app shape Privy reads on startup. Used only when the fixture has no live app. */
function privyAppStub() {
  return {
    id: 'preview',
    name: 'SupplierAdvisor',
    legal_name: null,
    logo_url: null,
    show_wallet_login_first: false,
    allowlist_config: {
      error_title: null,
      error_detail: null,
      cta_text: null,
      cta_link: null,
    },
    wallet_auth: false,
    email_auth: true,
    sms_auth: false,
    google_oauth: true,
    apple_oauth: true,
    twitter_oauth: false,
    discord_oauth: false,
    github_oauth: false,
    linkedin_oauth: false,
    disable_plus_emails: false,
    embedded_wallet_config: {
      create_on_login: 'off',
      ethereum: { create_on_login: 'off' },
      solana: { create_on_login: 'off' },
      require_user_owned_recovery_on_create: false,
      user_owned_recovery_options: ['user-passcode'],
      mode: 'user-controlled-server-wallets-only',
    },
    enforce_wallet_uis: false,
    legacy_wallet_ui_config: false,
    passkeys_for_signup_enabled: false,
    whatsapp_enabled: false,
    custom_api_url: null,
    smart_wallet_config: { enabled: false },
  };
}

export function installPreviewFetch(): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & { __saPreviewFetch?: boolean };
  if (w.__saPreviewFetch) return;
  w.__saPreviewFetch = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method === 'GET' && url.includes('auth.privy.io/api/v1/apps/')) {
      return new Response(JSON.stringify(privyAppStub()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (
      url.includes('auth.privy.io/api/v1/analytics_events') ||
      url.includes('pulse.walletconnect.org') ||
      url.includes('api.web3modal.org/appkit/')
    ) {
      return new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (isSameOriginApi(url)) {
      if (method !== 'GET' && method !== 'HEAD') {
        return new Response(JSON.stringify(WRITE_BODY), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const body = previewJson(url);
      return new Response(JSON.stringify(body ?? { success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return original(input, init);
  };
}
