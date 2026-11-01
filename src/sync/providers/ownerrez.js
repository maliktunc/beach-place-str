// OwnerRezAdapter — OAuth-ready stub. Fill OWNERREZ_CLIENT_ID/SECRET/ACCESS_TOKEN/PROPERTY_ID to enable.
const BASE = 'https://api.ownerrez.com/v2';
export class OwnerRezAdapter {
  constructor(env = process.env) { this.token = env.OWNERREZ_ACCESS_TOKEN; this.propertyId = env.OWNERREZ_PROPERTY_ID; this.clientId = env.OWNERREZ_CLIENT_ID; }
  get configured() { return Boolean(this.token && this.propertyId); }
  async #get(path) { const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${this.token}` } }); if (!r.ok) throw new Error(`OwnerRez HTTP ${r.status}`); return r.json(); }
  async getAvailability(from, to) {
    const booked = new Set(); for (const b of await this.getBookings(from, to)) { for (let d = new Date(b.checkIn); d < new Date(b.checkOut); d.setUTCDate(d.getUTCDate() + 1)) booked.add(d.toISOString().slice(0, 10)); }
    const rates = await this.getRates(from, to);
    return rates.map(r => ({ date: r.date, available: !booked.has(r.date), nightlyRate: r.nightlyRate ?? undefined, minStay: r.minStay, source: 'ownerrez' }));
  }
  async getRates(from, to) { const j = await this.#get(`/propertyrates?property_id=${this.propertyId}&start=${from}&end=${to}`); return (j.items || []).map(x => ({ date: x.date, nightlyRate: x.amount ?? null, minStay: x.min_nights, source: 'ownerrez' })); }
  async getBookings(from, to) { const j = await this.#get(`/bookings?property_ids=${this.propertyId}&from=${from}&to=${to}`); return (j.items || []).filter(b => !b.is_canceled).map(b => ({ bookingId: String(b.id), channel: /vrbo/i.test(b.channel_name) ? 'vrbo' : /airbnb/i.test(b.channel_name) ? 'airbnb' : 'direct', checkIn: b.arrival, checkOut: b.departure, guests: b.adults + (b.children || 0), total: b.total_amount })); }
  async getStatus() { return { provider: 'ownerrez', mode: 'live', configured: this.configured, ratesAvailable: true }; }
}
