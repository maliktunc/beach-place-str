# Beach Place STR — direct-booking site (Part 1)

Site for **Malik Tunc & Bruna Ferreira's** whole-house rental at 213 W Beach Place, Historic Hyde Park, Tampa. It has 3 bedrooms, 2 baths and a bonus playroom (not a bedroom), and it **sleeps 8 at most**. No parties.

Stack: **Node 20 + Express + better-sqlite3**, with server-rendered HTML, vanilla JS and CSS. There is no build step.

## Run locally
```bash
npm install
npm run dev          # http://localhost:3000  (node --watch)
# optional: npm run seed   -> wipe & reseed the DB (data/beach-place.db)
```
`npm start` runs it without watch. The environment variables are listed in `.env.example`. Set them in your shell; no dotenv loader is included. If no credentials are set, the site runs in **demo mode**.

| Route | Who | What |
|---|---|---|
| `/` | Public | Listing (placeholder photos, amenities, sleeping, location, house rules, rate card), availability calendar with nightly prices, live quote, request-to-book / inquiry form |
| `/trusted/:token` | Invite only (`noindex`) | Property and availability only, with no prices and no open booking. Has a simple "send us a note" inquiry. Demo token: `demo-trusted-7f3k9q` |
| `/owner/login`, `/owner/k/:key` | Owner | Owner key from `OWNER_KEY` (default `owner-demo-key`, **change it**). Sets an HttpOnly session cookie |
| `/owner` | Owner | Finance dashboard, direct inquiries, sync log, "Sync now" |
| `/api/availability`, `/api/quote`, `POST /api/bookings`, `POST /api/trusted/:token/inquiry`, `/api/sync-status`, `/owner/api/finance` | | JSON |

## Structure
```
src/
  server.js         routes, owner auth, trusted gating
  db.js, schema.sql SQLite + schema
  seed.js           Beach Place property, rate rules, sample direct/owner block, invite token, finance demo months
  availability.js   calendar + quote (availability ONLY from synced data minus direct holds)
  finance.js        actuals vs targets, drift flags
  views.js          HTML templates (public, trusted, owner)
  sync/
    types.js        SyncProvider interface + date helpers
    index.js        provider chain, server-side poller, writes DB, getSyncStatus()
    providers/hospitable.js  HospitableAdapter (REST, Bearer PAT) — preferred
    providers/ownerrez.js    OwnerRezAdapter (OAuth-ready stub)
    providers/ical.js        ICalAdapter (merged Airbnb+Vrbo .ics, blocks only, rates null)
    providers/stub.js        StubAdapter (demo, ~54% booked, ~$465 blended)
public/  app.js (calendar/forms), styles.css
data/    beach-place.db (created at runtime, git-ignored)
```

## Data model (SQLite)
- `properties`: listing facts. `max_guests` has CHECK ≤ 8.
- `rate_rules`: base midweek, Fri–Sat weekend, and peak windows (priority-based, with min nights). These are used only when the provider has no rates, for example in iCal mode.
- `bookings`: direct inquiries and requests, trusted inquiries, owner blocks, and synced Airbnb/Vrbo reservations (`source`, `external_id`, `synced_at`).
- `synced_calendar`: normalized per-night `available`, `nightly_cents`, `min_stay` and `source` from the active provider. **This is the source of truth for the calendar.** A night with no synced row counts as unavailable.
- `sync_state` (singleton) and `sync_log`: feed the status indicator and the history.
- `channel_listings`: Airbnb/Vrbo listing ids, iCal URLs and export tokens (for future push/export).
- `invite_tokens`: trusted-guest links (active flag and expiry).
- `finance_targets`, `finance_months`, `finance_line_items`: the owner finance model (see below).

## Channel sync
`SyncProvider` interface: `getAvailability(from,to)`, `getRates(from,to)`, `getBookings(from,to)`, `getStatus()`.
Normalized shapes: `{date, available, nightlyRate?, minStay?, source}` and `{bookingId, channel: airbnb|vrbo|direct, checkIn, checkOut, guests?, total?}`.

**Fallback order:** channel-manager API (`SYNC_PROVIDER`: Hospitable first, then OwnerRez) → merged iCal (`AIRBNB_ICAL_URL`, `VRBO_ICAL_URL`) → Stub. `DEMO_MODE=true` forces the Stub. If a provider throws, the sync falls through to the next one and records the error.
Polling runs server-side every `SYNC_INTERVAL_MINUTES`, clamped to 5–15. Tokens stay on the server and are never sent to the browser.
The status badge appears on every page. It shows the mode (Live / iCal-only / Demo), the provider, the age of the last success and any error. In iCal mode it also shows "Rates unavailable — iCal mode", and quotes fall back to the rate rules.

**Recommended pilot path:** Hospitable Host (about $29/mo) connected to both Airbnb and Vrbo, with the iCal feeds as a fallback.
Note: the Hospitable and OwnerRez endpoint paths and field mappings are best-effort. Check them against the real API docs with real credentials before going live.

## Owner finance dashboard (`/owner`, private)
- Locked targets: rent $3,200/mo, blended ADR $465, stabilized occupancy 54%, utilities model $350/mo.
- Per month: occupancy, ADR, Airbnb/Vrbo/direct payouts, rent, utilities, cleaning, supplies, channel fees (memo only, since payouts are already net), and net profit.
- Drift flags appear when occupancy is more than ±5 pts from target or ADR is more than ±5% from target. Both tolerances are set in `finance_targets`.
- Seeded with 3 **demo** months (Aug–Oct 2026, `data_source='demo'`). The design is ready to ingest payouts from the sync layer as `finance_line_items` with `data_source='sync'`.

## Left for Part 2
- Build-order polish and richer sample data (more months, seasonal peaks, sample guests).
- Real API mapping and testing for Hospitable/OwnerRez, payout ingestion into finance, and pushing direct bookings back to the channels (block dates).
- Payments/deposits, email notifications on inquiries, an owner UI for managing inquiries, invite tokens and rate rules.
- Real photos (current images are Unsplash placeholders labelled as such), SEO/meta, accessibility pass, tests, deployment.
