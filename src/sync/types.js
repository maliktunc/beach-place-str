/**
 * SyncProvider interface (all methods async, server-side only — tokens never reach the browser):
 *   getAvailability(from, to) -> [{ date, available, nightlyRate?, minStay?, source }]
 *   getRates(from, to)        -> [{ date, nightlyRate|null, minStay?, source }]
 *   getBookings(from, to)     -> [{ bookingId, channel:'airbnb'|'vrbo'|'direct', checkIn, checkOut, guests?, total? }]
 *   getStatus()               -> { provider, mode:'live'|'ical'|'demo', configured:boolean, ratesAvailable:boolean }
 * Dates are YYYY-MM-DD; check-out is exclusive. nightlyRate is in dollars.
 */
export const iso = d => d.toISOString().slice(0, 10);
export const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const eachNight = (from, to) => { const o = []; for (let d = from; d < to; d = addDays(d, 1)) o.push(d); return o; };
