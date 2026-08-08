/**
 * Assert MODULE_NAV feature trees are fully preserved by functional nav.
 * Used by unit tests / CI smoke.
 */
import { MODULE_NAV } from '@/lib/chrome/module-nav';
import {
  FUNCTIONAL_MODULE_ORDER,
  functionalSidebarModules,
} from '@/lib/chrome/functional-nav';

export type IntegrityReport = {
  ok: boolean;
  moduleCount: number;
  stepCount: number;
  missingFromOrder: string[];
  missingSteps: Array<{ moduleId: string; name: string; href: string }>;
  extraOnlyInOrder: string[];
};

export function auditModuleNavIntegrity(): IntegrityReport {
  const orderSet = new Set(FUNCTIONAL_MODULE_ORDER);
  const navIds = MODULE_NAV.map((m) => m.id);
  const missingFromOrder = navIds.filter((id) => !orderSet.has(id));
  const extraOnlyInOrder = FUNCTIONAL_MODULE_ORDER.filter(
    (id) => !navIds.includes(id)
  );

  // Simulate all modules enabled
  const sidebar = functionalSidebarModules({
    isModuleEnabled: () => true,
    packaging: null,
    simplifiedSchool: false,
  });

  const missingSteps: IntegrityReport['missingSteps'] = [];
  for (const m of MODULE_NAV) {
    const item = sidebar.find((s) => s.id === m.id);
    if (!item) {
      // home may be Control Tower with id home
      if (m.id === 'home') continue;
      for (const s of m.steps) {
        missingSteps.push({
          moduleId: m.id,
          name: s.name,
          href: s.href,
        });
      }
      continue;
    }
    const hrefs = new Set(item.sub.map((s) => s.href));
    for (const s of m.steps) {
      if (!hrefs.has(s.href)) {
        missingSteps.push({
          moduleId: m.id,
          name: s.name,
          href: s.href,
        });
      }
    }
  }

  const stepCount = MODULE_NAV.reduce((n, m) => n + m.steps.length, 0);

  return {
    ok: missingFromOrder.length === 0 && missingSteps.length === 0,
    moduleCount: MODULE_NAV.length,
    stepCount,
    missingFromOrder,
    missingSteps,
    extraOnlyInOrder,
  };
}
