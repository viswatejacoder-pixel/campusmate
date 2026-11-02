// Runs one change (create, edit, delete, complete) and then refreshes the lists (T-080 M3).
// - Success: the refresh is awaited, so the caller closes its form or dialog only once the list is up to date.
// - Failure: the error is rethrown for the caller to show, and nothing is refreshed, so what is on screen is left as it was.
//   Exception: 404 means the task no longer exists (for example deleted in another tab), so the lists are refreshed first.
// `refresh` must handle its own errors and never reject.
export async function runMutation(action, refresh) {
  try {
    await action();
  } catch (error) {
    if (error && error.status === 404) await refresh();
    throw error;
  }
  await refresh();
}
