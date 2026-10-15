import { describe, expect, it } from 'vitest';
import { reportFromMislaka } from '../src/import/mislaka.js';
import { importPensionReport } from '../src/import/pensionReport.js';
import { testDb } from './helpers.js';

const el = (tag: string, v: string | number) => `<${tag}>${v}</${tag}>`;
const balanceRow = (component: number, amount: number) =>
  `<PerutYitrot>${el('KOD-SUG-ITRA', 2)}${el('KOD-SUG-HAFRASHA', component)}${el('TOTAL-CHISACHON-MTZBR', amount)}</PerutYitrot>`;
const track = (name: string, amount: number, ret: number) =>
  `<PerutMasluleiHashkaa>${el('SHEM-MASLUL-HASHKAA', name)}${el('SCHUM-TZVIRA-BAMASLUL', amount)}${el('TSUA-NETO', ret)}</PerutMasluleiHashkaa>`;
const fee = (kind: number, pct: number) => `<PerutMivneDmeiNihul>${el('SUG-HOTZAA', kind)}${el('SHEUR-DMEI-NIHUL', pct)}</PerutMivneDmeiNihul>`;
// kind = SUG-HAFRASHA: 2 employee, 3 employer, 1 severance
const deposit = (valueDate: string, month: string, kind: number, amount: number) =>
  `<PerutHafkadotMetchilatShana>${el('TAARICH-ERECH-HAFKADA', valueDate)}${el('CHODESH-SACHAR', month)}${el('KOD-SUG-HAFKADA', 1)}${el('SUG-HAFRASHA', kind)}${el('SCHUM-HAFKADA-SHESHULAM', amount)}${el('SACHAR-BERAMAT-HAFKADA', 20000)}</PerutHafkadotMetchilatShana>`;
// one block per employer: the balance comes in rows per component, the tracks repeat per block
const part = (employer: string, rows: string, tracks: string, deposits: string, last: [string, string, number] | null) => `<PirteiTaktziv>
  <PirteiOved>${el('MPR-MAASIK-BE-YATZRAN', employer)}</PirteiOved>
  <BlockItrot><Yitrot>${el('TAARICH-ERECH-TZVIROT', '20260831')}${rows}</Yitrot></BlockItrot>
  ${tracks}${deposits}
  <PerutHotzaot><MivneDmeiNihul>${fee(1, 0.15)}${fee(2, 1.3)}</MivneDmeiNihul>
    <HotzaotBafoalLehodeshDivoach>${el('TOTAL-DMEI-NIHUL-HAFKADA', 40)}${el('TOTAL-DMEI-NIHUL-TZVIRA', 25)}</HotzaotBafoalLehodeshDivoach></PerutHotzaot>
  ${last ? `<PirteiHafkadaAchrona><PerutPirteiHafkadaAchrona>${el('TAARICH-HAFKADA-ACHARON', last[0])}${el('TAARICH-ERECH-HAFKADA', last[1])}${el('TOTAL-HAFKADA', last[2])}</PerutPirteiHafkadaAchrona></PirteiHafkadaAchrona>` : ''}
</PirteiTaktziv>`;

const pensionXml = `<?xml version="1.0" encoding="utf-8"?><Mimshak><YeshutYatzran>${el('SHEM-YATZRAN', 'קרן לדוגמה בע"מ')}<Mutzarim><Mutzar>
  <NetuneiMutzar>${el('SUG-MUTZAR', 2)}
    <YeshutMaasik>${el('MPR-MAASIK-BE-YATZRAN', 'A')}${el('SHEM-MAASIK', 'מעסיק קודם')}</YeshutMaasik>
    <YeshutMaasik>${el('MPR-MAASIK-BE-YATZRAN', 'B')}${el('SHEM-MAASIK', 'מעסיק נוכחי')}</YeshutMaasik>
  </NetuneiMutzar>
  <HeshbonotOPolisot><HeshbonOPolisa>
    ${el('MISPAR-POLISA-O-HESHBON', 'P-1')}${el('SHEM-TOCHNIT', 'מקיפה')}${el('TAARICH-NECHONUT', '20260831')}
    ${el('TAARICH-HITZTARFUT-MUTZAR', '20150501')}${el('STATUS-POLISA-O-CHESHBON', 1)}
    ${part('A', balanceRow(1, 100) + balanceRow(2, 50), track('מניות', 150, 4.4), deposit('20240910', '202408', 2, 500), null)}
    ${part('B', balanceRow(1, 1000) + balanceRow(2, 800) + balanceRow(3, 200), track('מניות', 1900, 4.4) + track('כללי', 100, 6.5),
      deposit('20260806', '202607', 2, 1200) + deposit('20260806', '202607', 3, 1300) + deposit('20260806', '202607', 1, 1500), ['202608', '20260806', 4000])}
    <Tsua>${el('SHEUR-TSUA-NETO', 5.36)}</Tsua>
    <YitraLefiGilPrisha><Kupot><Kupa>${el('KITZVAT-HODSHIT-TZFUYA', 9000)}</Kupa></Kupot></YitraLefiGilPrisha>
    <Kisuim><ZihuiKisui><KisuiBKerenPensia>
      ${el('SHEUR-KISUY-NECHUT', 75)}${el('SACH-PENSIAT-NECHUT', 14000)}${el('SHIUR-KISUY-ALMAN-O-ALMANA', 60)}${el('KITZBAT-SHEERIM-LEALMAN-O-ALMANA', 11000)}
      ${el('ALUT-KISUI-NECHUT', 90)}${el('ALUT-KISUY-SHEERIM', 120)}${el('SACHAR-KOVEA-LE-NECHUT-VE-SHEERIM', 20000)}
    </KisuiBKerenPensia></ZihuiKisui></Kisuim>
  </HeshbonOPolisa></HeshbonotOPolisot>
</Mutzar></Mutzarim></YeshutYatzran></Mimshak>`;

// an insurance-only policy (product type 7) is not a savings product
const riskXml = `<Mimshak><YeshutYatzran>${el('SHEM-YATZRAN', 'מבטחת')}<Mutzarim><Mutzar><NetuneiMutzar>${el('SUG-MUTZAR', 7)}</NetuneiMutzar>
  <HeshbonotOPolisot><HeshbonOPolisa>${el('SHEM-TOCHNIT', 'ריסק')}${el('MISPAR-POLISA-O-HESHBON', 'R-1')}</HeshbonOPolisa></HeshbonotOPolisot>
</Mutzar></Mutzarim></YeshutYatzran></Mimshak>`;

describe('pension clearing house XML', () => {
  const report = () => reportFromMislaka([{ name: 'pension.xml', xml: pensionXml }, { name: 'risk.xml', xml: riskXml }], 'דנה');

  it('sums the balance over every component and employer, and skips insurance-only products', () => {
    const r = report();
    expect(r.asOf).toBe('2026-08-31');
    expect(r.products).toHaveLength(1);
    expect(r.products[0].balance).toBe(2150);
    expect(r.summary.totalSavings).toBe(2150);
    expect(r.skipped).toEqual(['risk.xml: ריסק (סוג מוצר 7)']);
  });

  it('reads the agreed fees, tracks, coverages and deposits', () => {
    const p = report().products[0];
    expect(p).toMatchObject({
      type: 'pension', provider: 'קרן לדוגמה בע"מ', policyNumber: 'P-1', name: 'מקיפה', status: 'active', joinDate: '2015-05-01',
      feeDeposit: 1.3, feeBalance: 0.15, feesCharged: { fromDeposits: 80, fromBalance: 50 },
      employer: 'מעסיק נוכחי', lastDeposit: '2026-08-06', regularDeposit: 4000, insuredSalary: 20000, expectedAnnuity: 9000, periodReturn: 5.36,
      coverageCost: { disability: 90, survivors: 120 },
    });
    expect(p.tracks).toEqual([
      { name: 'מניות', balance: 2050, share: 95.35, returns: [null, null, null, null, null, null, null], periodReturn: 4.4 },
      { name: 'כללי', balance: 100, share: 4.65, returns: [null, null, null, null, null, null, null], periodReturn: 6.5 },
    ]);
    expect(p.coverages).toEqual([{ name: 'נכות', pct: 75, monthly: 14000 }, { name: 'אלמן/ה', pct: 60, monthly: 11000 }]);
    expect(p.deposits).toEqual([
      ['2024-09-10', '2024-08', 20000, 500, 0, 0, 500],
      ['2026-08-06', '2026-07', 20000, 1200, 1300, 1500, 4000],
    ]);
  });

  it('imports into the pension assets, and a re-import updates them', () => {
    const db = testDb();
    const member = db.prepare(`SELECT name FROM members ORDER BY id LIMIT 1`).pluck().get() as string;
    const { skipped, ...r } = reportFromMislaka([{ name: 'pension.xml', xml: pensionXml }], member);
    expect(skipped).toEqual([]);
    expect(importPensionReport(db, r)).toMatchObject({ assets: 1, created: 1, deposits: 2 });
    expect(importPensionReport(db, r)).toMatchObject({ assets: 1, created: 0 });
    // re-importing doesn't duplicate deposits, including rows without a salary month
    const noMonth = { ...r, products: r.products.map(p => ({ ...p, deposits: p.deposits!.map(d => [d[0], null, ...d.slice(2)] as typeof d) })) };
    importPensionReport(db, noMonth);
    importPensionReport(db, noMonth);
    expect(db.prepare(`SELECT COUNT(*) AS n, SUM(total) AS total FROM asset_deposits`).get()).toEqual({ n: 2, total: 4500 });
    expect(db.prepare(`SELECT fee_deposit_pct, fee_balance_pct, management_fee FROM assets`).get())
      .toEqual({ fee_deposit_pct: 1.3, fee_balance_pct: 0.15, management_fee: '1.30% מהפקדה · 0.15% מצבירה' });
    expect(db.prepare(`SELECT date, value FROM asset_snapshots`).all()).toEqual([{ date: '2026-08-31', value: 2150 }]);
  });
});
