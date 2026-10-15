import { describe, expect, it } from 'vitest';
import { detectLiabilities, loanKey } from '../src/analytics/loans.js';
import { supersedeByLiabilities } from '../src/analytics/scheduled.js';
import { addAccount, testDb } from './helpers.js';

const setup = () => {
  const db = testDb();
  addAccount(db, 'leumi:1', 'bank');
  addAccount(db, 'otsarHahayal:2', 'bank', 2);
  const ins = db.prepare(`INSERT INTO scheduled_items (name, kind, amount, day_of_month, bank_account_id, match_pattern, status)
    VALUES (?, ?, ?, ?, ?, ?, 'confirmed')`);
  const add = (name: string, kind: string, amount: number, day: number, account: string, pattern: string) =>
    Number(ins.run(name, kind, amount, day, account, pattern).lastInsertRowid);
  return { db, add };
};
const loans = (db: ReturnType<typeof testDb>) => db.prepare(`SELECT name, type, lender, owner_member_id AS owner,
  monthly_payment AS payment, payment_day AS day, source, archived FROM liabilities ORDER BY id`).all();

describe('loans detected from repayments', () => {
  it('merges principal and interest rows into one loan', () => {
    expect(loanKey('הלוואה תשלום קרן')).toBe(loanKey('הלוואה תשלום ריבית'));
  });

  it('creates one liability per loan, follows its payment, and keeps it on re-runs', () => {
    const { db, add } = setup();
    add('לאומי למשכנת-י', 'mortgage', -5000, 10, 'leumi:1', 'לאומי למשכנת י');
    add('פרעון הלוואה', 'loan', -2000, 2, 'leumi:1', 'פרעון הלוואה');
    const principal = add('101 הלוואה - תשלום קרן', 'loan', -900, 10, 'otsarHahayal:2', 'הלוואה תשלום קרן');
    add('00101 הלוואה - תשלום ריבית', 'loan', -100, 10, 'otsarHahayal:2', 'הלוואה תשלום ריבית');

    expect(detectLiabilities(db)).toEqual({ created: 3, linked: 4 });
    // created biggest payment first
    expect(loans(db)).toEqual([
      { name: 'משכנתא לאומי', type: 'mortgage', lender: 'לאומי', owner: 1, payment: 5000, day: 10, source: 'detected', archived: 0 },
      { name: 'הלוואה לאומי', type: 'loan', lender: 'לאומי', owner: 1, payment: 2000, day: 2, source: 'detected', archived: 0 },
      { name: 'הלוואה אוצר החייל', type: 'loan', lender: 'אוצר החייל', owner: 2, payment: 1000, day: 10, source: 'detected', archived: 0 },
    ]);

    // the repayment changes: the loan follows it; nothing new is created
    db.prepare(`UPDATE scheduled_items SET amount = -950 WHERE id = ?`).run(principal);
    expect(detectLiabilities(db)).toEqual({ created: 0, linked: 0 });
    expect((loans(db)[2] as { payment: number }).payment).toBe(1050);
  });

  it('never changes a loan the user edited', () => {
    const { db, add } = setup();
    const id = add('פרעון הלוואה', 'loan', -2000, 2, 'leumi:1', 'פרעון הלוואה');
    detectLiabilities(db);
    db.prepare(`UPDATE liabilities SET source = 'manual', monthly_payment = 1800`).run();
    db.prepare(`UPDATE scheduled_items SET amount = -5000 WHERE id = ?`).run(id);
    detectLiabilities(db);
    expect((loans(db)[0] as { payment: number }).payment).toBe(1800);
  });

  it('archives the detected loan when a loan the user entered replaces its repayment', () => {
    const { db, add } = setup();
    add('לאומי למשכנת-י', 'mortgage', -3000, 15, 'leumi:1', 'לאומי למשכנת');
    detectLiabilities(db);
    const mine = Number(db.prepare(`INSERT INTO liabilities (name, type) VALUES ('המשכנתא שלי', 'mortgage')`).run().lastInsertRowid);
    db.prepare(`INSERT INTO scheduled_items (name, kind, amount, day_of_month, bank_account_id, liability_id, status)
      VALUES ('המשכנתא שלי', 'mortgage', -2950, 15, 'leumi:1', ?, 'confirmed')`).run(mine);

    expect(supersedeByLiabilities(db)).toBe(1);
    detectLiabilities(db);
    expect(loans(db).map(l => (l as { archived: number }).archived)).toEqual([1, 0]);
  });
});
