const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = c => '$' + Math.round(c / 100).toLocaleString('en-US');
export const layout = (title, body, { robots = false } = {}) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${robots ? '<meta name="robots" content="noindex,nofollow">' : ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css"></head><body>${body}</body></html>`;

export const syncBadge = s => `<div class="sync sync-${esc(s.mode || 'none')}${s.error ? ' sync-err' : ''}" title="${esc(s.error || '')}">
<span class="dot"></span><strong>${esc(s.label || 'Not synced')}</strong>${s.provider ? ` · ${esc(s.provider)}` : ''}
${s.lastSuccessAt ? ` · synced ${s.ageMinutes < 1 ? 'just now' : s.ageMinutes + ' min ago'}` : ''}
${s.notice ? ` · <em>${esc(s.notice)}</em>` : ''}${s.error ? ` · <span class="err">error: ${esc(s.error)}</span>` : ''}</div>`;

const gallery = p => `<section class="gallery">${p.photos.map((ph, i) => `<figure class="${i === 0 ? 'hero-img' : ''}"><img src="${esc(ph.url)}" alt="${esc(ph.label)}" loading="lazy"><figcaption>${esc(ph.room)} · <span>placeholder image</span></figcaption></figure>`).join('')}</section>`;
const facts = p => `<ul class="facts"><li>${esc(p.property_type)}</li><li>${p.bedrooms} bedrooms</li><li>${p.bathrooms} baths</li><li>Bonus playroom</li><li>Sleeps ${p.max_guests} max</li><li>No parties</li></ul>`;
const details = p => `
<section class="card"><h2>About the home</h2><p>${esc(p.description)}</p></section>
<section class="card"><h2>Sleeping arrangements</h2><ul class="beds">${p.sleeping.map(s => `<li><strong>${esc(s.room)}</strong><span>${esc(s.beds)}</span></li>`).join('')}</ul>
<p class="muted">The playroom is a play space for kids and is not a bedroom. Maximum occupancy is ${p.max_guests} guests.</p></section>
<section class="card"><h2>Amenities</h2><ul class="chips">${p.amenities.map(a => `<li>${esc(a)}</li>`).join('')}</ul></section>
<section class="card"><h2>Location — ${esc(p.neighborhood)}</h2><div class="hl">${p.highlights.map(h => `<div><h3>${esc(h.title)}</h3><p>${esc(h.text)}</p></div>`).join('')}</div></section>
<section class="card"><h2>House rules</h2><ul class="rules">${p.house_rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul></section>`;
const rateCard = p => `<section class="card"><h2>Rates</h2><table class="rates">
<tr><td>Midweek (Sun–Thu)</td><td>$379–$449 / night</td></tr><tr><td>Weekend (Fri–Sat)</td><td>$549–$649 / night</td></tr>
<tr><td>Peak dates &amp; holidays</td><td>$699–$799 / night</td></tr><tr><td>Cleaning fee</td><td>${$(p.cleaning_fee_cents)} per stay</td></tr>
<tr><td>Minimum stay</td><td>2 nights (3 on peak weekends)</td></tr></table><p class="muted">Exact nightly prices for your dates appear in the calendar quote.</p></section>`;
const header = (sync, sub = '') => `<header class="top"><a class="brand" href="/">Beach Place<span>Hyde Park · Tampa</span></a>${sub}</header><div class="wrap">${syncBadge(sync)}</div>`;

export const publicPage = (p, sync) => layout(p.name, `${header(sync)}
<main class="wrap"><div class="title"><h1>${esc(p.name)}</h1><p class="addr">${esc(p.neighborhood)} · ${esc(p.address.replace(', Apt 1', ''))}</p>${facts(p)}</div>
${gallery(p)}<div class="grid"><div>${details(p)}${rateCard(p)}</div>
<aside id="book" class="card sticky"><h2>Check availability</h2><div id="cal" class="cal"></div>
<form id="bookForm" class="form" data-mode="public">
<div class="row"><label>Check-in<input name="checkIn" type="date" required></label><label>Check-out<input name="checkOut" type="date" required></label></div>
<label>Guests (max ${p.max_guests})<input name="guests" type="number" min="1" max="${p.max_guests}" value="4" required></label>
<div id="quote" class="quote muted">Select dates on the calendar.</div>
<label>Name<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>Phone<input name="phone"></label>
<label>Trip purpose<select name="purpose"><option>Family vacation</option><option>Two-couple trip</option><option>Medical / TGH visit</option><option>Convention / work trip with kids</option><option>Other</option></select></label>
<label>Message<textarea name="message" rows="3"></textarea></label>
<div class="row"><button name="type" value="request" class="btn">Request to book</button><button name="type" value="inquiry" class="btn ghost">Send inquiry</button></div>
<p id="result" class="result"></p><p class="muted small">No payment is taken. Malik &amp; Bruna confirm every request personally.</p></form></aside></div></main>
<footer class="wrap foot">Hosted by Malik Tunc &amp; Bruna Ferreira · Families welcome · No parties or events</footer><script src="/app.js"></script>`);

export const trustedPage = (p, sync, token) => layout('Beach Place — private preview', `${header(sync, '<span class="pill">Private preview</span>')}
<main class="wrap"><div class="title"><h1>Welcome — a private look at Beach Place</h1><p class="addr">${esc(p.neighborhood)}, Tampa</p>${facts(p)}</div>
${gallery(p)}<div class="grid"><div>${details(p)}</div>
<aside class="card sticky"><h2>Availability</h2><div id="cal" class="cal" data-readonly="1"></div>
<form id="bookForm" class="form" data-mode="trusted" data-token="${esc(token)}"><p class="muted">Interested in dates? Send us a note and we'll reply personally.</p>
<label>Name<input name="name" required></label><label>Email<input name="email" type="email" required></label>
<label>Dates you have in mind<input name="dates" placeholder="e.g. Mar 12–15"></label><label>Guests (max ${p.max_guests})<input name="guests" type="number" min="1" max="${p.max_guests}" value="4"></label>
<label>Message<textarea name="message" rows="3"></textarea></label><button class="btn">Send to Malik &amp; Bruna</button><p id="result" class="result"></p></form></aside></div></main>
<script src="/app.js"></script>`, { robots: true });

export const ownerLogin = (err) => layout('Owner login', `<main class="wrap narrow"><section class="card"><h1>Owner dashboard</h1>
<form method="post" action="/owner/login" class="form"><label>Owner key<input type="password" name="key" required autofocus></label><button class="btn">Sign in</button>${err ? '<p class="err">Invalid key.</p>' : ''}</form></section></main>`, { robots: true });

export const ownerPage = (p, sync, fin, inquiries, syncLog) => {
  const t = fin.targets; const last = fin.months.at(-1);
  const kpi = (l, v, s, bad) => `<div class="kpi${bad ? ' bad' : ''}"><span>${l}</span><strong>${v}</strong><small>${s}</small></div>`;
  return layout('Owner — Beach Place finances', `<header class="top"><a class="brand" href="/owner">Beach Place<span>Owner dashboard (private)</span></a><form method="post" action="/owner/logout"><button class="btn ghost sm">Log out</button></form></header>
<main class="wrap"><div class="row between">${syncBadge(sync)}<form method="post" action="/owner/sync"><button class="btn sm">Sync now</button></form></div>
<h2>Locked targets</h2><div class="kpis">${kpi('Monthly rent', $(t.monthly_rent_cents), 'fixed cost')}${kpi('Blended ADR target', $(t.target_adr_cents), `±${t.adr_drift_pct}% tolerance`)}${kpi('Stabilized occupancy', t.target_occupancy_pct + '%', `±${t.occupancy_drift_pts} pts tolerance`)}${kpi('Utilities model', $(t.utilities_model_cents), 'per month')}</div>
${last ? `<h2>Latest month · ${last.month} <small class="muted">(${last.source} data)</small></h2><div class="kpis">${kpi('Occupancy', last.occupancy.toFixed(0) + '%', `${last.nightsBooked}/${last.nightsAvailable} nights`, Math.abs(last.occupancy - t.target_occupancy_pct) > t.occupancy_drift_pts)}${kpi('ADR', $(last.adr), 'vs ' + $(t.target_adr_cents), Math.abs(last.adr / t.target_adr_cents - 1) * 100 > t.adr_drift_pct)}${kpi('Payouts', $(last.totalPayout), 'Airbnb + Vrbo + direct')}${kpi('Net profit', $(last.net), 'after cash expenses', last.net < 0)}</div>` : ''}
<section class="card"><h2>Monthly actuals vs targets</h2><div class="scroll"><table class="fin"><thead><tr><th>Month</th><th>Occ.</th><th>ADR</th><th>Airbnb payout</th><th>Vrbo payout</th><th>Direct</th><th>Rent</th><th>Utilities</th><th>Cleaning</th><th>Supplies</th><th>Furniture</th><th>Channel fees*</th><th>Net</th><th>Flags</th></tr></thead><tbody>
${fin.months.map(m => `<tr><td>${m.month}<br><small class="muted">${m.source}</small></td><td>${m.occupancy.toFixed(0)}%</td><td>${$(m.adr)}</td><td>${$(m.payouts.airbnb)}</td><td>${$(m.payouts.vrbo)}</td><td>${$(m.payouts.direct)}</td><td>${$(m.expenses.rent)}</td><td>${$(m.expenses.utilities)}</td><td>${$(m.expenses.cleaning)}</td><td>${$(m.expenses.supplies)}</td><td>${$(m.expenses.furniture)}</td><td>${$(m.expenses.channelFeesMemo)}</td><td class="${m.net < 0 ? 'neg' : 'pos'}">${$(m.net)}</td><td>${m.flags.length ? m.flags.map(f => `<span class="flag">⚠ ${esc(f)}</span>`).join('') : '<span class="ok">On target</span>'}</td></tr>`).join('')}
</tbody></table></div><p class="muted small">*Channel fees are shown for visibility; payouts are already net of them, so they are not subtracted again. Demo months are seeded until payout ingestion from the sync layer is connected.</p></section>
<h2>Furniture &amp; staging budget</h2><div class="kpis">${kpi('Budget', $(fin.furnitureBudgetCents), 'furniture & staging')}${kpi('Spent', $(fin.furnitureSpentCents), `${fin.furniturePurchases.length} Amazon orders`)}${kpi('Remaining', $(fin.furnitureRemainingCents), 'of budget', fin.furnitureRemainingCents < 0)}</div>
<section class="card"><h2>Furniture &amp; staging purchases</h2><div class="scroll"><table class="fin"><thead><tr><th>Month</th><th>Order #</th><th>Items</th><th>Amount</th></tr></thead><tbody>
${fin.furniturePurchases.map(i => `<tr><td>${esc(i.month)}</td><td>${esc(i.external_ref)}</td><td>${esc(i.note)}</td><td>$${(i.amount_cents / 100).toFixed(2)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">None yet</td></tr>'}
<tr><td colspan="3"><strong>Total spent</strong></td><td><strong>$${(fin.furnitureSpentCents / 100).toFixed(2)}</strong></td></tr></tbody></table></div><p class="muted small">Order Grand Totals from Amazon confirmation emails (incl. tax/shipping). Private — not shown on the public listing.</p></section>
<section class="card"><h2>Direct inquiries &amp; requests</h2><div class="scroll"><table class="fin"><thead><tr><th>Received</th><th>Type</th><th>Dates</th><th>Guests</th><th>Name</th><th>Email</th><th>Purpose / message</th></tr></thead><tbody>
${inquiries.map(b => `<tr><td>${esc(b.created_at)} UTC</td><td>${esc(b.status)}${b.source === 'trusted' ? ' (trusted link)' : ''}</td><td>${esc(b.check_in)} → ${esc(b.check_out)}</td><td>${b.guests}</td><td>${esc(b.guest_name)}</td><td>${esc(b.guest_email)}</td><td>${esc(b.trip_purpose || '')} ${esc(b.message || '')}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">None yet</td></tr>'}</tbody></table></div></section>
<section class="card"><h2>Recent sync log</h2><ul class="log">${syncLog.map(l => `<li class="${l.status}">${esc(l.created_at)} UTC · ${esc(l.status)} · ${esc(l.detail)}</li>`).join('')}</ul></section></main>`, { robots: true });
};
