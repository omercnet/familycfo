import { describe, expect, it } from 'vitest';
import { alertAction } from '../src/analytics/actions.js';
import type { Tx } from '../src/analytics/common.js';

const txs = [
  { id: 7, merchant: 'netflix', accountId: 'max:1234', date: '2026-09-02' },
  { id: 9, merchant: 'netflix', accountId: 'max:1234', date: '2026-10-02' },
  { id: 11, merchant: 'netflix', accountId: 'isracard:9', date: '2026-10-03' },
] as Tx[];
const action = (type: string, dedupeKey: string, extra: { txnIds?: number[]; data?: unknown } = {}) =>
  alertAction({ type, dedupeKey, txnIds: extra.txnIds ? JSON.stringify(extra.txnIds) : null, dataJson: extra.data ? JSON.stringify(extra.data) : null }, () => txs);

describe('alert actions', () => {
  it('links alerts about rows to exactly those rows', () => {
    expect(action('duplicate', 'dup:1:2', { txnIds: [1, 2] })).toEqual({ label: 'לשני החיובים', href: '/transactions?ids=1,2' });
    expect(action('fee', 'fee:5', { txnIds: [5] })?.href).toBe('/transactions?ids=5');
  });

  it('links a budget alert to the category in that month', () => {
    expect(action('budget', 'budget:12:h:2026-10:100', { data: { categoryId: 12 } })?.href).toBe('/transactions?category=12&cycle=2026-10');
  });

  it('finds a subscription\'s charges from its key when the alert has no rows (account ids contain ":")', () => {
    expect(action('new_subscription', 'newsub:netflix:max:1234')?.href).toBe('/transactions?ids=9,7');
    expect(action('price_increase', 'price:netflix:max:1234:2026-10-02')?.href).toBe('/transactions?ids=9,7');
  });

  it('links a card charge above the balance to that statement, and a big day to that day', () => {
    expect(action('card_vs_balance', 'cardbal:max:1234:2026-10-10')?.href).toBe('/transactions?account=max%3A1234&charge=2026-10-10');
    expect(action('big_day', 'bigday:2026-10-01')?.href).toBe('/transactions?from=2026-10-01&to=2026-10-01');
  });

  it('sends the rest to the page where they are handled', () => {
    expect(action('low_balance', 'lowbal:leumi:1:2026-10:neg')?.href).toBe('/cashflow');
    expect(action('planned_overdue', 'planned:3:2026-10-01')?.href).toBe('/fixed');
    expect(action('scrape_failed', 'scrape:leumi:2026-10-15')?.href).toBe('/?scrape=1');
    expect(action('unknown', 'x')).toBeNull();
  });
});
