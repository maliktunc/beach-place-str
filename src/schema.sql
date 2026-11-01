CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, address TEXT NOT NULL,
  neighborhood TEXT, property_type TEXT NOT NULL, bedrooms INTEGER NOT NULL, bathrooms REAL NOT NULL,
  max_guests INTEGER NOT NULL CHECK (max_guests <= 8), description TEXT, amenities_json TEXT,
  highlights_json TEXT, sleeping_json TEXT, house_rules_json TEXT, photos_json TEXT,
  cleaning_fee_cents INTEGER NOT NULL, base_min_nights INTEGER NOT NULL DEFAULT 2,
  timezone TEXT DEFAULT 'America/New_York'
);
-- Rate rules: highest priority matching rule wins per night.
-- kind: base | weekend | peak ; days_of_week: CSV of 0-6 (0=Sun) or NULL = all
CREATE TABLE IF NOT EXISTS rate_rules (
  id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES properties(id),
  name TEXT NOT NULL, kind TEXT NOT NULL, start_date TEXT, end_date TEXT, days_of_week TEXT,
  nightly_cents INTEGER NOT NULL, min_nights INTEGER, priority INTEGER NOT NULL DEFAULT 0
);
-- status: inquiry | request | confirmed | cancelled ; source: direct | airbnb | vrbo | owner_block
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES properties(id),
  source TEXT NOT NULL DEFAULT 'direct', external_id TEXT, status TEXT NOT NULL,
  check_in TEXT NOT NULL, check_out TEXT NOT NULL, guests INTEGER NOT NULL DEFAULT 1 CHECK (guests <= 8),
  guest_name TEXT, guest_email TEXT, guest_phone TEXT, trip_purpose TEXT, message TEXT,
  quoted_total_cents INTEGER, synced_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(source, external_id)
);
CREATE TABLE IF NOT EXISTS channel_listings (
  id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES properties(id),
  channel TEXT NOT NULL CHECK (channel IN ('airbnb','vrbo')), external_listing_id TEXT, mode TEXT NOT NULL DEFAULT 'demo', last_status TEXT, last_error TEXT,
  ical_import_url TEXT, ical_export_token TEXT, sync_enabled INTEGER NOT NULL DEFAULT 0,
  last_synced_at TEXT, UNIQUE(property_id, channel)
);
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY, channel_listing_id INTEGER REFERENCES channel_listings(id),
  direction TEXT NOT NULL, status TEXT NOT NULL, detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Normalized per-night availability/rates pulled from the active SyncProvider (source of truth for the calendar)
CREATE TABLE IF NOT EXISTS synced_calendar (
  date TEXT PRIMARY KEY, available INTEGER NOT NULL, nightly_cents INTEGER, min_stay INTEGER,
  source TEXT NOT NULL, synced_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1), provider TEXT, provider_mode TEXT, -- live | ical | demo
  last_attempt_at TEXT, last_success_at TEXT, last_error TEXT, rates_available INTEGER, details_json TEXT
);
CREATE TABLE IF NOT EXISTS invite_tokens (
  id INTEGER PRIMARY KEY, token TEXT UNIQUE NOT NULL, label TEXT, property_id INTEGER NOT NULL REFERENCES properties(id),
  active INTEGER NOT NULL DEFAULT 1, expires_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Owner finance (private)
CREATE TABLE IF NOT EXISTS finance_targets (
  property_id INTEGER PRIMARY KEY REFERENCES properties(id),
  monthly_rent_cents INTEGER NOT NULL, target_adr_cents INTEGER NOT NULL, target_occupancy_pct REAL NOT NULL,
  utilities_model_cents INTEGER NOT NULL, adr_drift_pct REAL NOT NULL DEFAULT 5, occupancy_drift_pts REAL NOT NULL DEFAULT 5,
  furniture_budget_cents INTEGER NOT NULL DEFAULT 500000
);
CREATE TABLE IF NOT EXISTS finance_months (
  id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES properties(id), month TEXT NOT NULL, -- YYYY-MM
  nights_available INTEGER NOT NULL, nights_booked INTEGER NOT NULL, gross_room_revenue_cents INTEGER NOT NULL,
  data_source TEXT NOT NULL DEFAULT 'demo', -- demo | manual | sync
  UNIQUE(property_id, month)
);
-- kind: payout | expense ; channel: airbnb|vrbo|direct|NULL ; category: rent|utilities|cleaning|supplies|channel_fees|payout|furniture|other
CREATE TABLE IF NOT EXISTS finance_line_items (
  id INTEGER PRIMARY KEY, finance_month_id INTEGER NOT NULL REFERENCES finance_months(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('payout','expense')), channel TEXT, category TEXT NOT NULL,
  amount_cents INTEGER NOT NULL, external_ref TEXT, note TEXT
);
