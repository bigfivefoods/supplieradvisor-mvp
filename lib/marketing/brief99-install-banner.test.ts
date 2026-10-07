import assert from 'node:assert/strict';

import {
  heroPassedViewport,
  isDismissed,
  isStandalone,
  shouldRevealInstallPrompt,
} from '../../components/pwa/InstallAppBanner';

assert.equal(heroPassedViewport(0, 844), false);
assert.equal(heroPassedViewport(900, 844), true);
assert.equal(
  shouldRevealInstallPrompt({
    dismissed: false,
    standalone: false,
    heroVisible: true,
    elapsedMs: 0,
  }),
  false
);
assert.equal(
  shouldRevealInstallPrompt({
    dismissed: false,
    standalone: false,
    heroVisible: false,
    elapsedMs: 0,
  }),
  true
);
assert.equal(
  shouldRevealInstallPrompt({
    dismissed: false,
    standalone: false,
    heroVisible: true,
    elapsedMs: 15000,
    stashedInstallEvent: true,
  }),
  false
);
assert.equal(
  shouldRevealInstallPrompt({
    dismissed: false,
    standalone: false,
    heroVisible: false,
    elapsedMs: 15000,
    stashedInstallEvent: true,
  }),
  true
);
assert.equal(
  shouldRevealInstallPrompt({
    dismissed: true,
    standalone: false,
    heroVisible: false,
    elapsedMs: 0,
  }),
  false
);
assert.equal(
  shouldRevealInstallPrompt({
    dismissed: false,
    standalone: true,
    heroVisible: false,
    elapsedMs: 0,
  }),
  false
);

const originalWindow = globalThis.window;
const originalLocalStorage = globalThis.localStorage;

try {
  Object.defineProperty(globalThis, 'window', {
    value: {
      matchMedia: () => ({ matches: true }),
      navigator: { standalone: true },
    },
    configurable: true,
    writable: true,
  });

  assert.equal(isStandalone(), true);

  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      store: new Map<string, string>(),
      getItem(key: string) {
        return this.store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        this.store.set(key, value);
      },
      removeItem(key: string) {
        this.store.delete(key);
      },
    },
    configurable: true,
    writable: true,
  });

  globalThis.localStorage.setItem('sa_pwa_install_dismissed_at', String(Date.now()));
  const savedDismissed = isDismissed();
  assert.equal(savedDismissed, true);
  assert.equal(
    shouldRevealInstallPrompt({
      dismissed: savedDismissed,
      standalone: false,
      heroVisible: false,
      elapsedMs: 0,
      stashedInstallEvent: true,
    }),
    false
  );
} finally {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  }

  if (originalLocalStorage === undefined) {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  } else {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
      writable: true,
    });
  }
}

console.log('brief99-install-banner.test.ts ok');
