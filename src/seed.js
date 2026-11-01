import { db } from './db.js';
import { pathToFileURL } from 'node:url';
const iso = d => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

export function seed({ reset = false } = {}) {
  if (reset) db.exec('DELETE FROM finance_line_items; DELETE FROM finance_months; DELETE FROM finance_targets; DELETE FROM invite_tokens; DELETE FROM synced_calendar; DELETE FROM sync_state; DELETE FROM sync_log; DELETE FROM channel_listings; DELETE FROM bookings; DELETE FROM rate_rules; DELETE FROM properties;');
  if (db.prepare('SELECT COUNT(*) c FROM properties').get().c) return;
  const ph = (room, q) => ({ room, label: `Placeholder — ${room} (not an actual photo of the home)`, url: `https://images.unsplash.com/${q}?auto=format&fit=crop&w=1200&q=70` });
  const p = db.prepare(`INSERT INTO properties (slug,name,address,neighborhood,property_type,bedrooms,bathrooms,max_guests,description,amenities_json,highlights_json,sleeping_json,house_rules_json,photos_json,cleaning_fee_cents,base_min_nights)
    VALUES (@slug,@name,@address,@neighborhood,@property_type,@bedrooms,@bathrooms,@max_guests,@description,@a,@h,@s,@r,@ph,@cf,2)`).run({
    slug: 'beach-place', name: 'Beach Place — Historic Hyde Park House',
    address: '213 W Beach Place, Apt 1, Tampa, FL 33606', neighborhood: 'Historic Hyde Park',
    property_type: 'Whole house', bedrooms: 3, bathrooms: 2, max_guests: 8,
    description: 'A whole house in Historic Hyde Park with three bedrooms, two baths and a bonus playroom for the kids. Gather around a dining table for eight, grill in the private courtyard, and walk to Bayshore Boulevard. Ideal for families, two-couple getaways, visitors to Tampa General Hospital, and convention travelers bringing the kids. Quiet house — no parties or events.',
    a: JSON.stringify(['Private courtyard','Outdoor grill','Dining seats 8','In-unit washer & dryer','Free parking','Bonus playroom','Full kitchen','Wi‑Fi','Air conditioning','Workspace']),
    h: JSON.stringify([
      { title: 'Walk to Bayshore Boulevard', text: 'Stroll the waterfront sidewalk along Hillsborough Bay.' },
      { title: 'Historic Hyde Park', text: 'Tree-lined streets, bungalows and Hyde Park Village shops & dining nearby.' },
      { title: 'Tampa General Hospital', text: 'Convenient for medical visits and families supporting a patient on Davis Islands.' },
      { title: 'Downtown & Convention Center', text: 'A short drive to the Tampa Convention Center and Riverwalk.' }]),
    s: JSON.stringify([
      { room: 'Bedroom 1', beds: '1 king bed' }, { room: 'Bedroom 2', beds: '1 king bed' },
      { room: 'Bedroom 3', beds: '2 full beds' }, { room: 'Living room', beds: '1 pull-out sofa' },
      { room: 'Bonus playroom', beds: 'Play space — not a bedroom' }]),
    r: JSON.stringify(['Maximum 8 guests','No parties or events','Quiet hours 10pm–8am','No smoking','Minimum stay 2 nights (3 on peak weekends)']),
    ph: JSON.stringify([
      ph('Living room','photo-1586023492125-27b2c045efd7'), ph('Kitchen & dining','photo-1556911220-bff31c812dba'),
      ph('King bedroom','photo-1505693416388-ac5ce068fe85'), ph('Full-bed room','photo-1595526114035-0d45ed16cfbf'),
      ph('Courtyard','photo-1600585154340-be6161a56a0c'), ph('Bayshore nearby','photo-1507525428034-b723cf961d3e')]),
    cf: 12500 });
  const pid = p.lastInsertRowid;
  const rr = db.prepare('INSERT INTO rate_rules (property_id,name,kind,start_date,end_date,days_of_week,nightly_cents,min_nights,priority) VALUES (?,?,?,?,?,?,?,?,?)');
  rr.run(pid, 'Midweek (Sun–Thu)', 'base', null, null, '0,1,2,3,4', 41900, 2, 0);
  rr.run(pid, 'Weekend (Fri–Sat)', 'weekend', null, null, '5,6', 59900, 2, 10);
  // Peak windows (sample): holidays + Gasparilla + spring break
  for (const [n, s, e, c] of [['Holiday peak','2026-12-20','2027-01-02',74900],['Gasparilla weekend','2027-01-29','2027-01-31',79900],['Spring break','2027-03-06','2027-03-21',69900]])
    rr.run(pid, n, 'peak', s, e, null, c, 3, 20);
  const today = iso(new Date());
  const bk = db.prepare('INSERT INTO bookings (property_id,source,external_id,status,check_in,check_out,guests,guest_name) VALUES (?,?,?,?,?,?,?,?)');
  // Airbnb/Vrbo reservations are NOT seeded — they arrive via the sync layer (demo adapters when no keys).
  bk.run(pid, 'direct', null, 'confirmed', addDays(today, 22), addDays(today, 25), 4, 'Sample direct guest');
  bk.run(pid, 'owner_block', null, 'confirmed', addDays(today, 33), addDays(today, 35), 0, 'Maintenance block');
  const cl = db.prepare('INSERT INTO channel_listings (property_id,channel,external_listing_id,ical_export_token,sync_enabled) VALUES (?,?,?,?,0)');
  cl.run(pid, 'airbnb', null, 'airbnb-export-token-placeholder');
  cl.run(pid, 'vrbo', null, 'vrbo-export-token-placeholder');
  db.prepare('INSERT INTO finance_targets (property_id,monthly_rent_cents,target_adr_cents,target_occupancy_pct,utilities_model_cents,adr_drift_pct,occupancy_drift_pts,furniture_budget_cents) VALUES (?,?,?,?,?,5,5,?)').run(pid, 320000, 46500, 54, 35000, 500000);
  // Demo months (labelled data_source='demo') — replace with sync-ingested payouts later.
  const fm = db.prepare('INSERT INTO finance_months (property_id,month,nights_available,nights_booked,gross_room_revenue_cents,data_source) VALUES (?,?,?,?,?,?)');
  const li = db.prepare('INSERT INTO finance_line_items (finance_month_id,kind,channel,category,amount_cents,note,external_ref) VALUES (?,?,?,?,?,?,NULL)');
  for (const [m, days, booked, adr, abShare, stays] of [['2026-08',31,13,43900,0.65,4],['2026-09',30,15,45800,0.6,5],['2026-10',31,17,47900,0.55,6]]) {
    const gross = booked * adr; const id = fm.run(pid, m, days, booked, gross, 'demo').lastInsertRowid;
    const ab = Math.round(gross * abShare), vr = gross - ab;
    li.run(id,'payout','airbnb','payout', Math.round(ab * 0.97) + stays * 12500 * abShare | 0, 'Demo Airbnb payout (after 3% host fee) incl. cleaning fees');
    li.run(id,'payout','vrbo','payout', Math.round(vr * 0.92) + stays * 12500 * (1-abShare) | 0, 'Demo Vrbo payout (after ~8% fees) incl. cleaning fees');
    li.run(id,'expense',null,'rent',320000,'Monthly rent');
    li.run(id,'expense',null,'utilities',35000,'Utilities/electric (model)');
    li.run(id,'expense',null,'cleaning',stays*9500,'Turnover cleaning');
    li.run(id,'expense',null,'supplies',stays*2500,'Consumables & supplies');
    li.run(id,'expense','airbnb','channel_fees',Math.round(ab*0.03),'Airbnb host fee (memo; already netted from payout)');
    li.run(id,'expense','vrbo','channel_fees',Math.round(vr*0.08),'Vrbo fees (memo; already netted from payout)');
  }
  seedFurniture(pid);
  db.prepare('INSERT INTO invite_tokens (token,label,property_id) VALUES (?,?,?)').run(process.env.DEMO_INVITE_TOKEN || 'demo-trusted-7f3k9q', 'Demo trusted guest link', pid);
}
// Actual furniture/staging purchases (Amazon Grand Totals from order-confirmation emails, shipped to Tampa).
export const FURNITURE_PURCHASES = [
  ['112-7065731-9050624', 'Trygoal 94" convertible sofa beds (blue + black)', 113374],
  ['112-7846725-6456208', 'EGOHOME King mattresses ×3', 84862],
  ['112-5231207-9644228', 'Coffee table, mirror, lamps, nightstands, hooks, trays, console', 70723],
  ['112-2031982-2789820', 'King bed frames ×3 (gold/beige)', 49540],
  ['112-1540347-5498643', 'Home décor', 7094],
  ['112-9465838-9164218', 'Plant stands (2)', 5802],
  ['112-2083580-6984206', 'Outdoor supplies', 5707],
  ['112-9570744-8633807', 'Kitchen & dining', 2901],
  ['112-0958209-8803432', 'Bathroom accessories', 2794],
  ['112-1129424-2014645', 'Outdoor décor', 2149],
  ['112-3586923-2100204', 'Outdoor décor', 644],
  ['112-7263358-9524238', 'Hardware', 606],
  ['112-6697270-9283453', 'Household supplies', 583],
  // Local in-store purchases (receipts / bank transactions)
  ['HOMEGOODS-0546', 'HomeGoods Walters Crossing, Tampa 2026-10-31 — scatter rugs, linens, snacks, body & bath, seasonal (Mastercard *9485)', 7805, 'local'],
  ['HOMEDEPOT-6327', 'The Home Depot S Dale Mabry, Tampa 2026-10-31 — staging/cleaning supplies (Swiffer, scissors, tape measures, Fabuloso, Dawn, Clorox, microfiber)', 9836, 'local'],
  ['GOODWILL-GANDY-105', 'Goodwill Gandy #105 — décor/furnishings (bank pending)', 15900, 'local'],
  ['HABITAT-21368', 'LS Habitat for Humanity ReStore — furnishings (bank tx 1 of 2)', 21368, 'local'],
  ['HABITAT-7095', 'LS Habitat for Humanity ReStore — furnishings (bank tx 2 of 2)', 7095, 'local'],
  ['CASH-DECOR-40', 'Cash décor purchase (cash-only shop, no receipt)', 4000, 'local'],
];
export function seedFurniture(pid) {
  let m = db.prepare("SELECT id FROM finance_months WHERE property_id=? AND month='2026-11'").get(pid);
  if (!m) {
    const id = db.prepare("INSERT INTO finance_months (property_id,month,nights_available,nights_booked,gross_room_revenue_cents,data_source) VALUES (?,?,30,0,0,'manual')").run(pid, '2026-11').lastInsertRowid;
    m = { id };
    const li = db.prepare('INSERT INTO finance_line_items (finance_month_id,kind,channel,category,amount_cents,note) VALUES (?,?,?,?,?,?)');
    li.run(id, 'expense', null, 'rent', 320000, 'Monthly rent');
    li.run(id, 'expense', null, 'utilities', 35000, 'Utilities/electric (model)');
  }
  db.prepare("DELETE FROM finance_line_items WHERE finance_month_id=? AND category='furniture'").run(m.id);
  const ins = db.prepare("INSERT INTO finance_line_items (finance_month_id,kind,channel,category,amount_cents,note,external_ref) VALUES (?,'expense',NULL,'furniture',?,?,?)");
  for (const [ref, item, cents, src] of FURNITURE_PURCHASES) ins.run(m.id, cents, src === 'local' ? item : `Amazon order ${ref} — ${item}`, ref);
}
if (process.argv.includes('--furniture-only')) { seedFurniture(db.prepare("SELECT id FROM properties WHERE slug='beach-place'").get().id); console.log('Furniture seeded.'); }
if (import.meta.url === pathToFileURL(process.argv[1]).href) { seed({ reset: process.argv.includes('--reset') }); console.log('Seeded.'); }
