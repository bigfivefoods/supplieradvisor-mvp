/** localStorage flag read before paint so the desktop sidebar width does not snap. */
export const SIDEBAR_COLLAPSED_KEY = 'sa-sidebar-collapsed';

/**
 * Runs from the root document head. Sets html[data-sidebar=collapsed] when
 * the visitor last collapsed the desktop sidebar. CSS owns the width, so the
 * first paint matches the settled column and the main pane does not jump.
 */
export const SIDEBAR_BOOT_SCRIPT = `(function(){
  try {
    if (localStorage.getItem('${SIDEBAR_COLLAPSED_KEY}') === '1') {
      document.documentElement.dataset.sidebar = 'collapsed';
    }
  } catch (e) {}
})();`;

export function applySidebarDataset(collapsed: boolean, motion: boolean) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (collapsed) root.dataset.sidebar = 'collapsed';
  else delete root.dataset.sidebar;
  if (motion) root.dataset.sidebarMotion = '1';
}
