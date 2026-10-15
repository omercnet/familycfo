import type { DB } from '../db/connection.js';
import { loadTransactions, type Tx } from './common.js';

/** Where to go to act on an alert or a recommendation: a page of the app, already filtered to the item. */
export interface Action { label: string; href: string }

/** The transactions page showing just these rows. */
export const txHref = (ids: number[]) => `/transactions?ids=${ids.join(',')}`;
const params = (p: Record<string, string | number | null | undefined>) =>
  new URLSearchParams(Object.entries(p).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString();

/** The rows of one merchant on one account, newest first (a subscription's charges). */
export function merchantRows(txs: Tx[], merchant: string, accountId: string, limit = 24): number[] {
  return txs.filter(t => t.merchant === merchant && t.accountId === accountId)
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit).map(t => t.id);
}

interface AlertRow { type: string; dedupeKey?: string; dedupe_key?: string; txnIds?: string | null; txn_ids?: string | null; dataJson?: string | null; data_json?: string | null }

/**
 * The action of a stored alert, from its type, its rows and its dedupe key (which carries the ids it was raised
 * for), so alerts stored before actions existed get one too.
 */
export function alertAction(row: AlertRow, txs: () => Tx[]): Action | null {
  const key = row.dedupeKey ?? row.dedupe_key ?? '';
  const ids = JSON.parse(row.txnIds ?? row.txn_ids ?? 'null') as number[] | null;
  const data = JSON.parse(row.dataJson ?? row.data_json ?? 'null') as Record<string, unknown> | null;
  const parts = key.split(':');
  switch (row.type) {
    case 'budget': {
      // budget:<category>:<member|h>:<YYYY-MM>:<level>
      const category = data?.categoryId ?? parts[1];
      return { label: 'לתנועות בקטגוריה', href: `/transactions?${params({ category: String(category), cycle: parts[3] })}` };
    }
    case 'duplicate': return ids ? { label: 'לשני החיובים', href: txHref(ids) } : null;
    case 'anomaly': return ids ? { label: 'לתנועה', href: txHref(ids) } : null;
    case 'fee': return ids ? { label: 'לתנועה', href: txHref(ids) } : null;
    case 'unmatched_card_bill': return ids ? { label: 'לסמן כהוצאה', href: txHref(ids) } : null;
    case 'new_subscription':
    case 'price_increase': {
      // newsub:<merchant>:<account> / price:<merchant>:<account>:<date> — the merchant may contain ':', the account has one
      const rest = key.slice(key.indexOf(':') + 1).split(':');
      if (row.type === 'price_increase') rest.pop();
      const account = rest.splice(-2).join(':');
      const rows = ids ?? merchantRows(txs(), rest.join(':'), account);
      return rows.length ? { label: 'לחיובים של המנוי', href: txHref(rows) } : null;
    }
    case 'low_balance': return { label: 'לתחזית התזרים', href: '/cashflow' };
    case 'card_vs_balance': {
      // cardbal:<card account>:<charge date>
      const date = parts.pop()!;
      return { label: 'לפירוט החיוב', href: `/transactions?${params({ account: parts.slice(1).join(':'), charge: date })}` };
    }
    case 'planned_overdue': return { label: 'לקבועות החודש', href: '/fixed' };
    case 'scrape_failed': return { label: 'לסרוק שוב', href: '/?scrape=1' };
    case 'big_day': {
      const date = parts[1];
      return { label: 'לתנועות של אותו יום', href: `/transactions?${params({ from: date, to: date })}` };
    }
    default: return null;
  }
}

/** Alerts for the API: each with its action. */
export function withActions(db: DB, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  let txs: Tx[] | undefined;
  const lazy = () => (txs ??= loadTransactions(db));
  return rows.map(r => ({ ...r, action: alertAction(r as unknown as AlertRow, lazy) }));
}
