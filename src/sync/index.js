// Sync orchestrator: picks provider (fallback: channel-manager API → merged iCal → stub), polls server-side,
// writes normalized data to synced_calendar + bookings, and records sync_state for the status indicator.
import { db } from '../db.js';
import { iso, addDays } from './types.js';
import { HospitableAdapter } from './providers/hospitable.js';
import { OwnerRezAdapter } from './providers/ownerrez.js';
import { ICalAdapter } from './providers/ical.js';
import { StubAdapter } from './providers/stub.js';

export function resolveProviders(env = process.env) {
  if (env.DEMO_MODE === 'true') return [new StubAdapter()];
  const api = { hospitable: new HospitableAdapter(env), ownerrez: new OwnerRezAdapter(env) };
  const chain = [];
  const preferred = (env.SYNC_PROVIDER || 'hospitable').toLowerCase();
  if (api[preferred]?.configured) chain.push(api[preferred]);
  for (const a of Object.values(api)) if (a.configured && !chain.includes(a)) chain.push(a);
  const ical = new ICalAdapter(env); if (ical.configured) chain.push(ical);
  chain.push(new StubAdapter());
  return chain;
}

export async function runSync({ days = 365 } = {}) {
  const from = iso(new Date()), to = addDays(from, days), now = new Date().toISOString();
  const errors = [];
  for (const p of resolveProviders()) {
    const st = await p.getStatus();
    try {
      const [avail, rates, bookings] = await Promise.all([p.getAvailability(from, to), p.getRates(from, to), p.getBookings(from, to)]);
      const rateMap = new Map(rates.map(r => [r.date, r]));
      const pid = db.prepare("SELECT id FROM properties WHERE slug='beach-place'").get()?.id;
      db.transaction(() => {
        db.prepare('DELETE FROM synced_calendar WHERE date >= ?').run(from);
        const ins = db.prepare('INSERT INTO synced_calendar (date,available,nightly_cents,min_stay,source,synced_at) VALUES (?,?,?,?,?,?)');
        for (const a of avail) { const r = a.nightlyRate ?? rateMap.get(a.date)?.nightlyRate; ins.run(a.date, a.available ? 1 : 0, r != null ? Math.round(r * 100) : null, a.minStay ?? rateMap.get(a.date)?.minStay ?? null, a.source, now); }
        // replace channel bookings in window with provider truth (direct-site requests are kept)
        db.prepare("DELETE FROM bookings WHERE synced_at IS NOT NULL AND check_out > ?").run(from);
        const ub = db.prepare(`INSERT INTO bookings (property_id,source,external_id,status,check_in,check_out,guests,quoted_total_cents,synced_at) VALUES (?,?,?,?,?,?,?,?,?)
          ON CONFLICT(source,external_id) DO UPDATE SET check_in=excluded.check_in,check_out=excluded.check_out,guests=excluded.guests,quoted_total_cents=excluded.quoted_total_cents,synced_at=excluded.synced_at`);
        for (const b of bookings) ub.run(pid, b.channel === 'direct' ? 'direct_synced' : b.channel, String(b.bookingId), 'confirmed', b.checkIn, b.checkOut, b.guests ?? 0, b.total != null ? Math.round(b.total * 100) : null, now);
        db.prepare(`INSERT INTO sync_state (id,provider,provider_mode,last_attempt_at,last_success_at,last_error,rates_available,details_json) VALUES (1,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET provider=excluded.provider,provider_mode=excluded.provider_mode,last_attempt_at=excluded.last_attempt_at,last_success_at=excluded.last_success_at,last_error=excluded.last_error,rates_available=excluded.rates_available,details_json=excluded.details_json`)
          .run(st.provider, st.mode, now, now, errors.length ? errors.join(' | ') : null, st.ratesAvailable ? 1 : 0, JSON.stringify({ days: avail.length, bookings: bookings.length, fellBackFrom: errors }));
        db.prepare('UPDATE channel_listings SET last_synced_at=?, last_status=?, mode=?').run(now, 'success', st.mode);
        db.prepare('INSERT INTO sync_log (direction,status,detail) VALUES (?,?,?)').run('pull', 'success', `${st.provider}/${st.mode}: ${avail.length} days, ${bookings.length} bookings`);
      })();
      return getSyncStatus();
    } catch (e) {
      errors.push(`${st.provider}: ${e.message}`);
      db.prepare('INSERT INTO sync_log (direction,status,detail) VALUES (?,?,?)').run('pull', 'error', `${st.provider}: ${e.message}`);
    }
  }
  db.prepare(`INSERT INTO sync_state (id,last_attempt_at,last_error) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET last_attempt_at=excluded.last_attempt_at,last_error=excluded.last_error`).run(now, errors.join(' | '));
  return getSyncStatus();
}

export function getSyncStatus() {
  const s = db.prepare('SELECT * FROM sync_state WHERE id=1').get();
  if (!s) return { provider: null, mode: null, lastSuccessAt: null, ageMinutes: null, error: 'Not synced yet', ratesAvailable: false };
  const age = s.last_success_at ? Math.round((Date.now() - Date.parse(s.last_success_at)) / 60000) : null;
  return { provider: s.provider, mode: s.provider_mode, label: { live: 'Live channel manager', ical: 'iCal-only', demo: 'Demo data' }[s.provider_mode] || 'Unknown',
    lastSuccessAt: s.last_success_at, lastAttemptAt: s.last_attempt_at, ageMinutes: age, error: s.last_error, ratesAvailable: Boolean(s.rates_available),
    notice: s.provider_mode === 'ical' ? 'Rates unavailable — iCal mode' : null };
}

export function startPolling() {
  const mins = Math.min(15, Math.max(5, Number(process.env.SYNC_INTERVAL_MINUTES) || 10));
  runSync().catch(e => console.error('sync failed', e));
  return setInterval(() => runSync().catch(e => console.error('sync failed', e)), mins * 60000);
}
