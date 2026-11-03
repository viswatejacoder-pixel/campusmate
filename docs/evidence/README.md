# Evidence notes

## T-090 screenshots (`RES-01-*`, `RES-02-*`, `RES-03-*`)

Taken 2026-11-03 in headless Microsoft Edge against the Vite dev server (client only). The `/api` responses were **mocked in the browser** with fake data (Asha Verma, `asha.test@example.com`); Express and MySQL were not running. They show layout and styling at 360 px (`-360`), 768 px (`-768`) and 1280 px (`-1280`). They are **not** evidence of live API behaviour, and they do not by themselves close RES-01 to RES-03; those cases still need the live-server run in T-100.

## T-090 v2 screenshots (*-v2.png)

Taken after the dashboard redesign (sidebar, header search, summary cards, task panel, Upcoming deadlines / Progress / Subjects panels) with headless Microsoft Edge over the DevTools protocol at true viewport widths 360, 768, 1024 and 1280 px (shoot-v2.mjs). The /api responses came from mock-api-v2.mjs (fake data: Asha Verma, asha.test@example.com); **Express and MySQL were not running**, so this is layout evidence only, not live-API evidence. Measured horizontal overflow was 0 px at every width. The original screenshots above are unchanged.



## T-090 v3 screenshots (*-v3.png)

Editorial Ink finish plus the task preview (max five pending tasks, overdue first, in-place "View all tasks"). Taken with `shoot-v3.mjs` (headless Edge, true viewport widths) against the Vite dev server, with `/api` answered by `mock-api-v3.mjs` (fake data: 8 pending tasks incl. 2 overdue, 4 completed). **Express and MySQL were not running**: layout and client-behaviour evidence only, **not** live-API evidence; live checks remain for T-100.

- `RES-01-dashboard-360-v3`, `RES-02-dashboard-768/1024/1280-v3`: default preview (5 task rows, no filter bar).
- `RES-04-expanded-360/1280-v3`: after "View all tasks" (all 12 rows, filter bar shown).
- `RES-03-search-360/1280-v3`: search "lab" (preview bypassed: 2 matches incl. a completed task, filter bar shown).

Measured horizontal overflow was 0 px in all eight screenshots. Earlier screenshots are unchanged.
