import { db } from './db.js';
import { pathToFileURL } from 'node:url';
const iso = d => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

export function seed({ reset = false } = {}) {
  if (reset) db.exec('DELETE FROM finance_line_items; DELETE FROM finance_months; DELETE FROM finance_targets; DELETE FROM invite_tokens; DELETE FROM synced_calendar; DELETE FROM sync_state; DELETE FROM sync_log; DELETE FROM channel_listings; DELETE FROM bookings; DELETE FROM rate_rules; DELETE FROM properties;');
  if (db.prepare('SELECT COUNT(*) c FROM properties').get().c) {
    const existing = db.prepare("SELECT id FROM properties WHERE slug='beach-place'").get();
    if (existing) seedFurniture(existing.id);
    return;
  }
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
  ['112-0958209-8803432', '2026-10-29 FORASTO toilet brush+plunger 2pk', 2794],
  ['112-1129424-2014645', 'Outdoor décor', 2149],
  ['112-3586923-2100204', '2026-10-31 Sukh white pebbles', 644],
  ['112-7263358-9524238', 'Hardware', 606],
  ['112-6697270-9283453', '2026-10-31 SetSail extra-long duster', 583],
  // Amazon orders logged Nov 10, 2026 (order totals include tax). Skipped 3 already-seeded refs above.
  ['113-5955654-7496211', '2026-11-11 Giraffe Tools garden hose holder (150 ft)', 1547],
  ['112-0451783-3186636', '2026-11-09 VTRIN 10-tier shoe rack', 2149],
  ['112-3538274-8056259', '2026-11-09 Merkisa slim laundry basket beige', 2297],
  ['112-6788258-1255443', '2026-11-08 YISURE white + navy short shower curtains + Seasonlife vinyl record player', 13240],
  ['112-6673094-7577808', '2026-11-08 FolkArt gold treasure paint', 964],
  ['112-6145961-8026608', '2026-11-08 GIGIZAZA gold velvet pillow covers 2pk', 1396],
  ['112-1994805-0520261', '2026-11-08 Dried flower bouquet w/ pampas', 1429],
  ['112-7086154-6130655', '2026-11-08 Dusty blue dried flower bouquet', 1718],
  ['113-3366743-3933000', '2026-11-08 Bethom gold towel rack w/ shelf x4 (replacement)', 0],
  ['112-4267935-4553802', '2026-11-07 Gold cheesecloth table runner', 676],
  ['112-1675020-8761868', '2026-11-07 Blank recipe book', 1396],
  ['112-5915266-3357802', '2026-11-07 ZICPERY guest book', 1074],
  ['112-4126025-7109052', '2026-11-06 Nicpro gold acrylic paint', 963],
  ['112-9775111-4105014', '2026-11-05 Ruelvth marble shower window curtain', 1504],
  ['112-0227553-1569811', '2026-11-05 Command picture hanging strips', 1504],
  ['112-2713457-8078627', '2026-11-03 Uniqcovosa gold plant stand', 2901],
  ['113-5933675-6905035', '2026-11-03 Bedsure king duvet set black x2', 8598],
  ['113-0074511-4272223', '2026-11-03 Bedsure king duvet set dusty blue x2', 8124],
  ['112-6002715-9014619', '2026-11-03 Bedsure king duvet set olive', 3976],
  ['112-3295799-3021039', '2026-11-03 Bedsure king duvet set olive', 3976],
  ['112-9121716-6982630', '2026-11-03 Bedsure king duvet set dark grey x4', 17560],
  ['112-1701659-1045037', '2026-11-03 Bedsure king duvet set light brown x2', 8812],
  ['112-6494205-2992223', '2026-11-03 Bedsure king duvet set navy x2', 8376],
  ['112-2105087-7476233', '2026-11-03 Amazon Basics king comforter inserts', 15960],
  ['112-8678842-3689062', '2026-11-03 JOLLYVOGUE king pillows 2pk', 2578],
  ['112-8941171-3022624', '2026-11-03 JOLLYVOGUE king pillows 4pk', 5098],
  ['112-7646858-1021010', '2026-11-02 Golden push pins', 536],
  ['112-6634492-4222617', '2026-11-02 7-pc knife set beige', 3116],
  ['112-4376651-6811402', '2026-11-02 Ruelvth short shower curtain burgundy', 2041],
  ['112-8371027-7801039', '2026-11-02 Bethom gold towel rack w/ shelf x4', 10316],
  ['112-8000730-6650650', '2026-11-02 Candle light bulbs 6pk', 1289],
  ['112-8376681-7145816', '2026-11-02 GoBright E12 LED candelabra bulbs 12pk', 1828],
  ['112-5972399-8788254', '2026-11-02 Apple Barrel white paint', 319],
  ['112-5188703-0438641', '2026-11-02 AIDEA Swedish dishcloths 20pk', 1074],
  ['112-8832940-7225819', '2026-11-02 Gold 3-chamber shower dispenser x2', 3222],
  ['112-1928223-4136230', '2026-11-02 Ginger Lily body wash 128oz', 2364],
  ['112-3006226-4100243', '2026-11-02 Ginger Lily conditioner 128oz', 2686],
  ['112-3157644-5709848', '2026-11-02 Ginger Lily shampoo 128oz', 2686],
  ['112-8009872-3807440', '2026-11-02 Amber glass soap dispenser x2', 2148],
  ['112-6046352-7394602', '2026-11-02 RUFCRIL sink soap dispenser', 1074],
  ['112-4930064-1922628', '2026-11-02 Seventh Generation dish soap refill 3pk', 2378],
  ['112-7060404-6843468', '2026-11-01 Bookends', 1881],
  ['112-5127819-5452225', '2026-11-01 Metal plate stand easel', 1289],
  ['112-9329130-2773852', '2026-10-21 Vintage music wall art', 1547],
  ['112-2549041-3856255', '2026-10-21 Gold 5x7 frames 2pk', 1074],
  ['112-6232810-2729003', '2026-10-21 MIEVU 8x10 gold frame', 872],
  ['112-9692162-3605050', '2026-10-21 Mkono wall propagation planters 4pk', 2579],
  ['112-0196917-3554636', '2026-10-21 Kathfly glass wall vase planters', 6879],
  ['112-2960519-4869025', '2026-10-21 Turkish kitchen runner 2x6 dark red', 3224],
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
