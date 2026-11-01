import { db } from './db.js';
export function financeReport(pid) {
  const t = db.prepare('SELECT * FROM finance_targets WHERE property_id=?').get(pid);
  const months = db.prepare('SELECT * FROM finance_months WHERE property_id=? ORDER BY month').all(pid).map(m => {
    const items = db.prepare('SELECT * FROM finance_line_items WHERE finance_month_id=?').all(m.id);
    const sum = f => items.filter(f).reduce((a, i) => a + i.amount_cents, 0);
    const payouts = { airbnb: sum(i => i.kind === 'payout' && i.channel === 'airbnb'), vrbo: sum(i => i.kind === 'payout' && i.channel === 'vrbo'), direct: sum(i => i.kind === 'payout' && i.channel === 'direct') };
    const cat = c => sum(i => i.kind === 'expense' && i.category === c);
    // channel fees are memo lines (payouts are already net of them) — excluded from cash expenses
    const expenses = { rent: cat('rent'), utilities: cat('utilities'), cleaning: cat('cleaning'), supplies: cat('supplies'), furniture: cat('furniture'), other: cat('other'), channelFeesMemo: cat('channel_fees') };
    const totalPayout = payouts.airbnb + payouts.vrbo + payouts.direct;
    const cashExpenses = expenses.rent + expenses.utilities + expenses.cleaning + expenses.supplies + expenses.furniture + expenses.other;
    const occupancy = m.nights_booked / m.nights_available * 100;
    const adr = m.nights_booked ? m.gross_room_revenue_cents / m.nights_booked : 0;
    const flags = [];
    if (occupancy < t.target_occupancy_pct - t.occupancy_drift_pts) flags.push(`Occupancy ${occupancy.toFixed(0)}% is below target ${t.target_occupancy_pct}%`);
    if (occupancy > t.target_occupancy_pct + t.occupancy_drift_pts) flags.push(`Occupancy ${occupancy.toFixed(0)}% is above target — consider raising rates`);
    if (adr < t.target_adr_cents * (1 - t.adr_drift_pct / 100)) flags.push(`ADR $${(adr / 100).toFixed(0)} is below target $${t.target_adr_cents / 100}`);
    if (adr > t.target_adr_cents * (1 + t.adr_drift_pct / 100)) flags.push(`ADR $${(adr / 100).toFixed(0)} is above target $${t.target_adr_cents / 100}`);
    return { month: m.month, source: m.data_source, nightsBooked: m.nights_booked, nightsAvailable: m.nights_available, occupancy, adr, payouts, totalPayout, expenses, cashExpenses, net: totalPayout - cashExpenses, flags };
  });
  const furniturePurchases = db.prepare(`SELECT li.*, fm.month FROM finance_line_items li JOIN finance_months fm ON fm.id=li.finance_month_id
    WHERE fm.property_id=? AND li.kind='expense' AND li.category='furniture' ORDER BY fm.month, li.amount_cents DESC`).all(pid);
  const furnitureBudgetCents = t.furniture_budget_cents ?? 500000;
  const furnitureSpentCents = furniturePurchases.reduce((a, i) => a + i.amount_cents, 0);
  return { targets: t, months, furnitureBudgetCents, furnitureSpentCents, furnitureRemainingCents: furnitureBudgetCents - furnitureSpentCents, furniturePurchases };
}
