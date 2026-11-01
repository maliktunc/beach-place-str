(() => {
  const cal = document.getElementById('cal'), form = document.getElementById('bookForm');
  if (!cal) return;
  const mode = form?.dataset.mode, token = form?.dataset.token, readonly = cal.dataset.readonly === '1';
  let days = {}, view = new Date(), sel = { in: null, out: null };
  view.setDate(1);
  const iso = d => d.toISOString().slice(0, 10);
  const money = c => '$' + Math.round(c / 100).toLocaleString();
  async function load() {
    const from = iso(new Date()), to = iso(new Date(Date.now() + 365 * 864e5));
    const j = await (await fetch(`/api/availability?from=${from}&to=${to}${token ? '&invite=' + token : ''}`)).json();
    j.days.forEach(d => days[d.date] = d); render();
  }
  function render() {
    const y = view.getFullYear(), m = view.getMonth(), first = new Date(Date.UTC(y, m, 1)), n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    let h = `<div class="cal-head"><button type="button" data-nav="-1" aria-label="Previous month">‹</button><strong>${first.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong><button type="button" data-nav="1" aria-label="Next month">›</button></div><div class="cal-grid">`;
    h += ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<span class="dow">${d}</span>`).join('') + '<span></span>'.repeat(first.getUTCDay());
    for (let i = 1; i <= n; i++) {
      const ds = iso(new Date(Date.UTC(y, m, i))), d = days[ds];
      const cls = !d ? 'past' : d.available ? 'open' : 'taken';
      const inRange = sel.in && sel.out && ds >= sel.in && ds < sel.out, edge = ds === sel.in || ds === sel.out;
      h += `<button type="button" class="day ${cls}${inRange ? ' range' : ''}${edge ? ' edge' : ''}" data-d="${ds}" ${!d || readonly ? 'disabled' : ''}>${i}${d?.nightlyCents && !readonly ? `<small>$${Math.round(d.nightlyCents / 100)}</small>` : ''}</button>`;
    }
    cal.innerHTML = h + '</div><div class="legend"><span class="open">Available</span><span class="taken">Booked</span></div>';
  }
  cal.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]'); if (nav) { view.setMonth(view.getMonth() + Number(nav.dataset.nav)); return render(); }
    const b = e.target.closest('.day'); if (!b || readonly) return; const d = b.dataset.d;
    if (!sel.in || sel.out || d <= sel.in) { if (!days[d]?.available) return; sel = { in: d, out: null }; } else sel.out = d;
    form.checkIn.value = sel.in || ''; form.checkOut.value = sel.out || ''; render(); updateQuote();
  });
  async function updateQuote() {
    const q = document.getElementById('quote'); if (!q || !form.checkIn.value || !form.checkOut.value) return;
    const j = await (await fetch(`/api/quote?checkIn=${form.checkIn.value}&checkOut=${form.checkOut.value}&guests=${form.guests.value}`)).json();
    q.className = 'quote ' + (j.ok ? '' : 'err');
    q.innerHTML = j.ok ? `${j.nights} nights · ${money(j.nightlyCents)}<br>Cleaning ${money(j.cleaningCents)}<br><strong>Estimated total ${money(j.totalCents)}</strong>` : j.errors.join('<br>');
  }
  if (mode === 'public') ['checkIn', 'checkOut', 'guests'].forEach(n => form[n].addEventListener('change', () => { sel = { in: form.checkIn.value, out: form.checkOut.value }; render(); updateQuote(); }));
  form?.addEventListener('submit', async e => {
    e.preventDefault(); const data = Object.fromEntries(new FormData(form)); data.type = e.submitter?.value || 'inquiry';
    const url = mode === 'trusted' ? `/api/trusted/${token}/inquiry` : '/api/bookings';
    const j = await (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).json();
    const r = document.getElementById('result'); r.className = 'result ' + (j.ok ? 'ok' : 'err');
    r.textContent = j.ok ? (mode === 'trusted' ? 'Thanks! We\'ll be in touch soon.' : `Thanks! Your ${j.status === 'request' ? 'booking request' : 'inquiry'} #${j.id} was received.`) : j.errors.join(' ');
    if (j.ok) { form.reset(); if (mode === 'public') { sel = {}; days = {}; load(); } }
  });
  load();
})();
