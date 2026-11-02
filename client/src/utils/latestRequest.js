// Guard against stale async results (T-080 M2). Take a ticket with start() before a request; when the answer arrives, only
// apply it if isCurrent(ticket) is still true. A newer start() (overlapping or retried request) or invalidate() (the component
// unmounted) makes every older ticket stale, so late answers never overwrite newer state or set state on an unmounted page.
export function createLatestRequestGuard() {
  let latest = 0;
  return {
    start() {
      latest += 1;
      return latest;
    },
    isCurrent: (ticket) => ticket === latest,
    invalidate() {
      latest += 1;
    },
  };
}
