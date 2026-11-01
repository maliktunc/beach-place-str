// HospitableAdapter — preferred default. Hospitable connects Airbnb + Vrbo and exposes a REST API (Bearer PAT).
const BASE = process.env.HOSPITABLE_API_BASE || 'https://public.api.hospitable.com/v2';
export class HospitableAdapter {
  constructor(env = process.env) { this.token = env.HOSPITABLE_API_TOKEN; this.propertyId = env.HOSPITABLE_PROPERTY_ID; }
  get configured() { return Boolean(this.token && this.propertyId); }
  async #get(path) {
    const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' } });
    if (!r.ok) throw new Error(`Hospitable ${path.split('?')[0]} HTTP ${r.status}`);
    return r.json();
  }
  async #calendar(from, to) { return (await this.#get(`/properties/${this.propertyId}/calendar?start_date=${from}&end_date=${to}`)).data?.days || []; }
  async getAvailability(from, to) {
    return (await this.#calendar(from, to)).map(d => ({ date: d.date, available: Boolean(d.status?.available ?? d.available), nightlyRate: d.price?.amount != null ? d.price.amount / 100 : undefined, minStay: d.min_stay, source: 'hospitable' }));
  }
  async getRates(from, to) { return (await this.getAvailability(from, to)).map(({ date, nightlyRate, minStay, source }) => ({ date, nightlyRate: nightlyRate ?? null, minStay, source })); }
  async getBookings(from, to) {
    const j = await this.#get(`/reservations?properties[]=${this.propertyId}&start_date=${from}&end_date=${to}`);
    return (j.data || []).filter(r => r.status !== 'cancelled').map(r => ({ bookingId: r.id, channel: /vrbo|homeaway/i.test(r.platform) ? 'vrbo' : /airbnb/i.test(r.platform) ? 'airbnb' : 'direct', checkIn: r.arrival_date?.slice(0, 10), checkOut: r.departure_date?.slice(0, 10), guests: r.guests?.total, total: r.financials?.host?.revenue?.amount != null ? r.financials.host.revenue.amount / 100 : undefined }));
  }
  async getStatus() { return { provider: 'hospitable', mode: 'live', configured: this.configured, ratesAvailable: true }; }
}
