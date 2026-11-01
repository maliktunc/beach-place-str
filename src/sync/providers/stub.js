// StubAdapter — deterministic demo data (~54% booked, ~$465 blended ADR) so the site runs without credentials.
import { eachNight, addDays } from '../types.js';
const rateFor = date => { const dow = new Date(date + 'T00:00:00Z').getUTCDay(); const m = date.slice(5);
  if (m >= '12-20' || m <= '01-02') return [749, 3]; if (dow === 5 || dow === 6) return [599, 2]; return [409, 2]; };
export class StubAdapter {
  configured = true;
  constructor() { this.anchor = new Date().toISOString().slice(0, 10); }
  #bookings(from, to) {
    // repeating 14-night pattern: ~7.5 nights booked (≈54%)
    const out = []; const ch = ['airbnb', 'vrbo', 'airbnb', 'direct'];
    let i = 0;
    for (let s = addDays(this.anchor, 2); s < to; s = addDays(s, 14), i++) {
      const a = { checkIn: s, checkOut: addDays(s, 3) }, b = { checkIn: addDays(s, 7), checkOut: addDays(s, 11 + (i % 2)) };
      for (const [k, r] of [a, b].entries()) if (r.checkOut > from) {
        const nights = eachNight(r.checkIn, r.checkOut);
        out.push({ bookingId: `DEMO-${i}-${k}`, channel: ch[(i * 2 + k) % 4], checkIn: r.checkIn, checkOut: r.checkOut, guests: 4 + ((i + k) % 5), total: nights.reduce((t, d) => t + rateFor(d)[0], 0) + 125 });
      }
    }
    return out;
  }
  async getBookings(from, to) { return this.#bookings(from, to); }
  async getRates(from, to) { return eachNight(from, to).map(date => ({ date, nightlyRate: rateFor(date)[0], minStay: rateFor(date)[1], source: 'stub' })); }
  async getAvailability(from, to) {
    const booked = new Set(this.#bookings(from, to).flatMap(b => eachNight(b.checkIn, b.checkOut)));
    return eachNight(from, to).map(date => ({ date, available: !booked.has(date), nightlyRate: rateFor(date)[0], minStay: rateFor(date)[1], source: 'stub' }));
  }
  async getStatus() { return { provider: 'stub', mode: 'demo', configured: true, ratesAvailable: true }; }
}
