import type { DB } from '../db/connection.js';
import { companyName } from '../db/migrations.js';
import { merchantKey } from './common.js';
import type { ScheduledItem } from './scheduled.js';

/** "הלוואה תשלום קרן" and "הלוואה תשלום ריבית" are the same loan: drop the words that split one payment into parts. */
export const loanKey = (pattern: string): string =>
  pattern.replace(/תשלום|קרן|ריבית|הצמדה|הפרשי/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Loans and mortgages from the repayments seen on bank accounts: every loan/mortgage scheduled item
 * without a liability gets one (principal + interest rows of the same loan share one), so it shows on
 * the Loans page and in net worth. The monthly payment and day follow the repayments while the loan is
 * 'detected'; the balance, rate and dates aren't on the bank statement and are left to the user.
 * Loans the user entered or edited are never touched.
 */
export function detectLiabilities(db: DB): { created: number; linked: number } {
  const items = db.prepare(`SELECT * FROM scheduled_items WHERE kind IN ('loan','mortgage') AND status != 'dismissed'
    AND bank_account_id IS NOT NULL AND liability_id IS NULL ORDER BY amount`).all() as ScheduledItem[];
  const detected = db.prepare(`SELECT id, type, bank_account_id, match_pattern FROM liabilities WHERE source = 'detected'`)
    .all() as { id: number; type: string; bank_account_id: string; match_pattern: string | null }[];
  const names = new Set(db.prepare(`SELECT name FROM liabilities`).pluck().all() as string[]);
  const owner = db.prepare(`SELECT owner_member_id FROM accounts WHERE id = ?`).pluck();
  const insert = db.prepare(`INSERT INTO liabilities (name, type, lender, owner_member_id, bank_account_id, match_pattern, source)
    VALUES (?, ?, ?, ?, ?, ?, 'detected')`);
  const link = db.prepare(`UPDATE scheduled_items SET liability_id = ? WHERE id = ?`);
  const keyOf = (accountId: string, type: string, pattern: string) => `${accountId}|${type}|${loanKey(pattern)}`;
  const byKey = new Map(detected.filter(l => l.match_pattern).map(l => [keyOf(l.bank_account_id, l.type, l.match_pattern!), l.id]));
  let created = 0, linked = 0;

  db.transaction(() => {
    for (const s of items) {
      const pattern = s.match_pattern ?? merchantKey(s.name);
      const key = keyOf(s.bank_account_id!, s.kind, pattern);
      let id = byKey.get(key);
      if (id == null) {
        const bank = companyName(s.bank_account_id!);
        let name = `${s.kind === 'mortgage' ? 'משכנתא' : 'הלוואה'} ${bank}`;
        if (names.has(name)) name = `${name} · ${loanKey(pattern)}`;
        names.add(name);
        id = Number(insert.run(name, s.kind, bank, owner.get(s.bank_account_id) ?? null, s.bank_account_id, pattern).lastInsertRowid);
        byKey.set(key, id);
        created++;
      }
      link.run(id, s.id);
      linked++;
    }
    // follow the repayments: the parts add up to the monthly payment
    db.prepare(`UPDATE liabilities SET
        monthly_payment = (SELECT ROUND(-SUM(amount), 2) FROM scheduled_items WHERE liability_id = liabilities.id AND status != 'dismissed'),
        payment_day = (SELECT MIN(day_of_month) FROM scheduled_items WHERE liability_id = liabilities.id AND status != 'dismissed')
      WHERE source = 'detected' AND archived = 0`).run();
    // every repayment dismissed (not a loan, or replaced by one the user entered): the detected loan goes too
    db.prepare(`UPDATE liabilities SET archived = 1 WHERE source = 'detected' AND archived = 0
      AND NOT EXISTS (SELECT 1 FROM scheduled_items WHERE liability_id = liabilities.id AND status != 'dismissed')`).run();
  })();
  return { created, linked };
}
