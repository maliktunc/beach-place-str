import { db } from './db.js';
import { eachNight } from './sync/types.js';
export const property = () => { const p = db.prepare("SELECT * FROM properties WHERE slug='beach-place'").get();
  for (const k of ['amenities', 'highlights', 'sleeping', 'house_rules', 'photos']) p[k] = JSON.parse(p[k + '_json']); return p; };

function ruleRate(pid, date) {
  const dow = new Date(date + 'T00:00:00Z').getUTCDay();
  const rules = db.prepare('SELECT * FROM rate_rules WHERE property_id=? ORDER BY priority DESC').all(pid);
  return rules.find(r => (!r.start_date || (date >= r.start_date && date <= r.end_date)) && (!r.days_of_week || r.days_of_week.split(',').includes(String(dow))));
}
// Availability comes ONLY from synced channel data, minus direct-site holds. No synced row => unavailable.
export function calendar(from, to) {
  const p = property();
  const synced = new Map(db.prepare('SELECT * FROM synced_calendar WHERE date>=? AND date<?').all(from, to).map(r => [r.date, r]));
  const held = new Set(db.prepare("SELECT check_in,check_out FROM bookings WHERE synced_at IS NULL AND status IN ('confirmed','request') AND check_out>? AND check_in<?").all(from, to).flatMap(b => eachNight(b.check_in, b.check_out)));
  return eachNight(from, to).map(date => {
    const s = synced.get(date); const rule = ruleRate(p.id, date);
    return { date, available: Boolean(s?.available) && !held.has(date), synced: Boolean(s),
      nightlyCents: s?.nightly_cents ?? rule?.nightly_cents ?? null, rateSource: s?.nightly_cents != null ? 'channel' : 'rate_rule',
      minStay: Math.max(s?.min_stay || 0, rule?.min_nights || p.base_min_nights) };
  });
}
export function quote(checkIn, checkOut, guests) {
  const p = property(); const errors = [];
  if (!checkIn || !checkOut || checkOut <= checkIn) errors.push('Choose a valid check-in and check-out.');
  if (!(guests >= 1 && guests <= p.max_guests)) errors.push(`Guests must be between 1 and ${p.max_guests}.`);
  if (errors.length) return { ok: false, errors };
  const nights = calendar(checkIn, checkOut);
  if (nights.some(n => !n.available)) errors.push('Some selected nights are not available.');
  const minStay = Math.max(...nights.map(n => n.minStay));
  if (nights.length < minStay) errors.push(`Minimum stay for these dates is ${minStay} nights.`);
  const nightly = nights.reduce((t, n) => t + (n.nightlyCents || 0), 0);
  return { ok: !errors.length, errors, nights: nights.length, nightlyCents: nightly, cleaningCents: p.cleaning_fee_cents, totalCents: nightly + p.cleaning_fee_cents, minStay };
}
