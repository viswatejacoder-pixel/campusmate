// Sidebar active item helpers (pure, so they can be tested without a browser).

// Index of the nav item whose href equals `hash` ("#tasks-heading"), or -1.
export function indexFromHash(hash, hrefs) {
  return typeof hash === 'string' ? hrefs.indexOf(hash) : -1;
}

// Targets whose tops are this close count as being on the same row (on desktop the Tasks and Deadlines panels sit side by side).
const SAME_ROW_PX = 200;

// Which item is "in view". `tops` holds each target's distance from the viewport top (null when the target is not on
// the page yet). The first item (Dashboard) is the default. Among the targets that have reached `line`, the one nearest
// the line wins; targets on the same row resolve to the one nearest the top of the viewport (ties: the earlier item). At the very top the first item is active, and at the
// very bottom the last item that exists, because a short last section can never be scrolled up to the line.
export function pickActive(tops, { atTop = false, atBottom = false, line = 0 } = {}) {
  if (atTop) return 0;
  if (atBottom) {
    for (let i = tops.length - 1; i > 0; i--) if (tops[i] !== null) return i;
    return 0;
  }
  let max = -Infinity;
  for (let i = 1; i < tops.length; i++) if (tops[i] !== null && tops[i] <= line && tops[i] > max) max = tops[i];
  if (max === -Infinity) return 0;
  let best = 0;
  for (let i = 1; i < tops.length; i++) {
    if (tops[i] === null || tops[i] > line || tops[i] < max - SAME_ROW_PX) continue;
    if (best === 0 || Math.abs(tops[i]) < Math.abs(tops[best])) best = i; // same row: the heading nearest the top of the viewport
  }
  return best;
}
