// ICalAdapter — merges Airbnb + Vrbo .ics exports. Blocked dates only; rates are null.
import { eachNight } from '../types.js';
export function parseIcs(text) {
  const ev = []; let cur = null;
  for (const line of text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)) {
    if (line === 'BEGIN:VEVENT') cur = {}; else if (line === 'END:VEVENT') { if (cur?.start && cur?.end) ev.push(cur); cur = null; }
    else if (cur) { const i = line.indexOf(':'); const key = line.slice(0, i).split(';')[0], val = line.slice(i + 1);
      const d = v => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
      if (key === 'DTSTART') cur.start = d(val); if (key === 'DTEND') cur.end = d(val); if (key === 'UID') cur.uid = val; if (key === 'SUMMARY') cur.summary = val; }
  }
  return ev;
}
export class ICalAdapter {
  constructor(env = process.env) { this.feeds = [['airbnb', env.AIRBNB_ICAL_URL], ['vrbo', env.VRBO_ICAL_URL]].filter(([, u]) => u); }
  get configured() { return this.feeds.length > 0; }
  async #events() {
    const all = await Promise.all(this.feeds.map(async ([channel, url]) => { const r = await fetch(url); if (!r.ok) throw new Error(`${channel} iCal HTTP ${r.status}`); return parseIcs(await r.text()).map(e => ({ ...e, channel })); }));
    return all.flat();
  }
  async getAvailability(from, to) {
    const blocked = new Set((await this.#events()).flatMap(e => eachNight(e.start, e.end)));
    return eachNight(from, to).map(date => ({ date, available: !blocked.has(date), nightlyRate: undefined, minStay: undefined, source: 'ical' }));
  }
  async getRates(from, to) { return eachNight(from, to).map(date => ({ date, nightlyRate: null, source: 'ical' })); }
  async getBookings(from, to) {
    return (await this.#events()).filter(e => e.end > from && e.start < to && !/not available|blocked/i.test(e.summary || ''))
      .map(e => ({ bookingId: e.uid || `${e.channel}-${e.start}`, channel: e.channel, checkIn: e.start, checkOut: e.end }));
  }
  async getStatus() { return { provider: 'ical', mode: 'ical', configured: this.configured, ratesAvailable: false }; }
}
