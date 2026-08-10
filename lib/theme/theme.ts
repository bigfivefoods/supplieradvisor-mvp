/**
 * SupplierAdvisor theme — light (default) + dark.
 * Applied via `class="dark"` on <html> (Tailwind class strategy).
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'sa-theme';
export const THEME_COOKIE_KEY = 'sa-theme';

export function isThemeMode(v: unknown): v is ThemeMode {
  return v === 'light' || v === 'dark' || v === 'system';
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return getSystemTheme();
  return mode;
}

export function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeMode(raw)) return raw;
  } catch {
    /* soft */
  }
  return 'light';
}

export function persistTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    // 1 year cookie — optional for SSR hints later
    document.cookie = `${THEME_COOKIE_KEY}=${mode};path=/;max-age=31536000;samesite=lax`;
  } catch {
    /* soft */
  }
}

/** Apply resolved theme to the document root. */
export function applyResolvedTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  root.dataset.theme = resolved;
  // Meta theme-color for mobile chrome
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute(
      'content',
      resolved === 'dark' ? '#000000' : '#00b4d8'
    );
  }
}

/** Inline script source — run before paint to avoid FOUC. */
export const THEME_BOOT_SCRIPT = `(function(){
  try {
    var k='${THEME_STORAGE_KEY}';
    var m=localStorage.getItem(k);
    if(m!=='light'&&m!=='dark'&&m!=='system') m='light';
    var dark=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
    var r=document.documentElement;
    if(dark){r.classList.add('dark');r.style.colorScheme='dark';r.dataset.theme='dark';}
    else{r.classList.remove('dark');r.style.colorScheme='light';r.dataset.theme='light';}
  } catch(e) {}
})();`;
