/**
 * Import the pension clearing house (מסלקה פנסיונית) XML files directly — no hand extraction:
 *   npm run import:mislaka -- --member <name> data/mislaka/            (a folder of *.xml, or the files)
 *   npm run import:mislaka -- --member <name> --out data/reports/x.json data/mislaka/   (also write the JSON it built)
 *
 * The files follow the uniform interface (ממשק אחיד). Each policy becomes a product of a pension report and goes
 * through importPensionReport, so it updates the same assets a JSON import created. Insurance-only products
 * (risk policies) are skipped — הר הביטוח / the insurance import covers them.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { XMLParser } from 'fast-xml-parser';
import { getDb } from '../db/connection.js';
import { importPensionReport, type Product, type Report } from './pensionReport.js';

type Node = Record<string, unknown>;

/** elements that repeat — always parsed as arrays so one occurrence looks like many */
const ARRAYS = new Set(['Mutzar', 'HeshbonOPolisa', 'PirteiTaktziv', 'PerutMasluleiHashkaa', 'PerutHafkadotMetchilatShana',
  'PerutMivneDmeiNihul', 'Yitrot', 'PerutYitrot', 'PerutPirteiHafkadaAchrona', 'PerutHafkadaAchrona', 'YeshutMaasik',
  'ZihuiKisui', 'Kupa', 'Tsua']);
const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true, isArray: name => ARRAYS.has(name) });

// SUG-MUTZAR: 2 pension fund, 3 provident fund, 4 study fund, 5 managers' insurance (savings, shown with pension);
// 7 is an insurance-only policy
const PRODUCT_LABELS: Record<Product['type'], string> = { pension: 'פנסיה / ביטוח מנהלים', kupat_gemel: 'קופת גמל', keren_hishtalmut: 'קרן השתלמות' };
const PRODUCT_TYPES: Record<string, Product['type']> = { '2': 'pension', '3': 'kupat_gemel', '4': 'keren_hishtalmut', '5': 'pension' };
// SUG-HOTZAA in the fee structure: 1 = from the balance, 2 = from deposits. The rate is the regulatory cap less ACHOZ-HATAVA
// (the discount): a pension fund's 1.30% = 6% (deposit cap) × (1 − 78.33%), a provident fund's 0.60% = 1.05% (balance cap) × (1 − 42.9%)
const FEE_BALANCE = '1', FEE_DEPOSIT = '2';
// SUG-HAFRASHA of a deposit row (KOD-SUG-HAFKADA is the deposit type, not the part). Checked against the statutory
// rates: pension 2 = employee 6%, 3 = employer 6.5%, 1 = severance 8.33%; study fund 8 = employee 2.5%, 9 = employer 7.5%.
// Anything else: by the depositor (SUG-MAFKID 1 = employee).
const DEPOSIT_PARTS: Record<string, 'employee' | 'employer' | 'severance'> = { '1': 'severance', '2': 'employee', '3': 'employer', '8': 'employee', '9': 'employer' };
const depositPart = (r: Node) => DEPOSIT_PARTS[String(r['SUG-HAFRASHA'])] ?? (str(r['SUG-MAFKID']) === '1' ? 'employee' : 'employer');

const list = (v: unknown): Node[] => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]) as Node[];
const at = (node: unknown, path: string): unknown =>
  path.split('/').reduce<unknown>((n, key) => (n && typeof n === 'object' ? (n as Node)[key] : undefined), node);
/** every node at the path, descending into arrays on the way */
const all = (node: unknown, path: string): Node[] =>
  path.split('/').reduce<Node[]>((nodes, key) => nodes.flatMap(n => list(n[key])), list(node));
const num = (v: unknown): number | null => {
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
/** YYYYMMDD → YYYY-MM-DD; YYYYMM → YYYY-MM */
const date = (v: unknown): string | null => {
  const s = str(v);
  if (!s || !/^\d{6}(\d{2})?$/.test(s)) return null;
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : `${s.slice(0, 4)}-${s.slice(4)}`;
};
const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;
const sum = (values: (number | null)[]) => values.reduce<number>((s, v) => s + (v ?? 0), 0);
/** the value most rows have (an employer's sub-accounts usually share one rate) */
function common(values: (number | null)[]): number | null {
  const counts = new Map<number, number>();
  for (const v of values) if (v != null) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function product(provider: string, mutzar: Node, policy: Node): Product | null {
  const type = PRODUCT_TYPES[String(at(mutzar, 'NetuneiMutzar/SUG-MUTZAR'))];
  if (!type) return null;
  const parts = list(policy.PirteiTaktziv);

  const balance = round(sum(all(parts, 'BlockItrot/Yitrot/PerutYitrot').map(r => num(r['TOTAL-CHISACHON-MTZBR']))));
  const fees = all(parts, 'PerutHotzaot/MivneDmeiNihul/PerutMivneDmeiNihul');
  const fee = (kind: string) => common(fees.filter(f => str(f['SUG-HOTZAA']) === kind).map(f => num(f['SHEUR-DMEI-NIHUL'])));
  // what was actually charged in the reporting month, in ₪
  const charged = all(parts, 'PerutHotzaot/HotzaotBafoalLehodeshDivoach');

  const trackRows = all(parts, 'PerutMasluleiHashkaa');
  const byTrack = new Map<string, { balance: number; periodReturn: number | null }>();
  for (const r of trackRows) {
    const name = str(r['SHEM-MASLUL-HASHKAA']) ?? '—';
    const t = byTrack.get(name) ?? { balance: 0, periodReturn: num(r['TSUA-NETO']) };
    t.balance += num(r['SCHUM-TZVIRA-BAMASLUL']) ?? 0;
    byTrack.set(name, t);
  }
  const tracksTotal = [...byTrack.values()].reduce((s, t) => s + t.balance, 0);

  // deposits since the start of the year, one row per value date + salary month
  const deposits = new Map<string, { valueDate: string; month: string | null; salary: number | null; employee: number; employer: number; severance: number; total: number }>();
  for (const r of all(parts, 'PerutHafkadotMetchilatShana')) {
    const valueDate = date(r['TAARICH-ERECH-HAFKADA']);
    if (!valueDate) continue;
    const month = date(r['CHODESH-SACHAR'])?.slice(0, 7) ?? null;
    const key = `${valueDate}|${month}`;
    const d = deposits.get(key) ?? { valueDate, month, salary: num(r['SACHAR-BERAMAT-HAFKADA']), employee: 0, employer: 0, severance: 0, total: 0 };
    const amount = num(r['SCHUM-HAFKADA-SHESHULAM']) ?? 0;
    d[depositPart(r)] += amount;
    d.total += amount;
    deposits.set(key, d);
  }

  // the last deposit: its month (TAARICH-HAFKADA-ACHARON, YYYYMM) groups the rows, its value date is the date
  const lastDeposits = all(parts, 'PirteiHafkadaAchrona/PerutPirteiHafkadaAchrona');
  const lastMonth = lastDeposits.map(d => str(d['TAARICH-HAFKADA-ACHARON'])).filter((d): d is string => !!d).sort().at(-1);
  const latest = lastDeposits.filter(d => str(d['TAARICH-HAFKADA-ACHARON']) === lastMonth);
  const lastDeposit = latest.map(d => date(d['TAARICH-ERECH-HAFKADA'])).filter((d): d is string => !!d).sort().at(-1) ?? null;

  // several employers (one block each): the one that deposited last
  const lastValueDate = (part: Node) => all(part, 'PerutHafkadotMetchilatShana').concat(all(part, 'PirteiHafkadaAchrona/PerutPirteiHafkadaAchrona'))
    .map(d => str(d['TAARICH-ERECH-HAFKADA']) ?? '').sort().at(-1) ?? '';
  const employers = list(at(mutzar, 'NetuneiMutzar/YeshutMaasik'));
  const lastPart = [...parts].sort((a, b) => lastValueDate(b).localeCompare(lastValueDate(a)))[0];
  const employerId = lastPart ? str(at(lastPart, 'PirteiOved/MPR-MAASIK-BE-YATZRAN')) : null;
  const employer = employers.length === 1 ? employers[0] : employers.find(e => str(e['MPR-MAASIK-BE-YATZRAN']) === employerId);

  const cover = all(policy, 'Kisuim/ZihuiKisui').map(k => at(k, 'KisuiBKerenPensia') as Node | undefined).find(Boolean);
  const coverages = cover ? [
    { name: 'נכות', pct: num(cover['SHEUR-KISUY-NECHUT']), monthly: num(cover['SACH-PENSIAT-NECHUT']) },
    { name: 'אלמן/ה', pct: num(cover['SHIUR-KISUY-ALMAN-O-ALMANA']), monthly: num(cover['KITZBAT-SHEERIM-LEALMAN-O-ALMANA']) },
    { name: 'יתום', pct: num(cover['SHIUR-KISUY-YATOM']), monthly: num(cover['KITZBAT-SHEERIM-LEYATOM']) },
    { name: 'הורה נתמך', pct: num(cover['SHIUR-KISUY-HORE-NITMACH']), monthly: num(cover['KITZBAT-SHEERIM-LEHORE-NITMACH']) },
  ].filter(c => c.monthly).map(c => ({ name: c.name, pct: c.pct ?? 0, monthly: c.monthly! })) : [];

  const annuity = all(policy, 'YitraLefiGilPrisha/Kupot/Kupa').map(k => num(k['KITZVAT-HODSHIT-TZFUYA']));

  return {
    type, provider,
    name: str(policy['SHEM-TOCHNIT']) ?? '—',
    policyNumber: str(policy['MISPAR-POLISA-O-HESHBON']) ?? '—',
    balance,
    feeDeposit: fee(FEE_DEPOSIT), feeBalance: fee(FEE_BALANCE),
    employer: employer ? str(employer['SHEM-MAASIK']) : null,
    status: str(policy['STATUS-POLISA-O-CHESHBON']) === '1' ? 'active' : 'inactive',
    joinDate: date(policy['TAARICH-HITZTARFUT-MUTZAR']),
    lastDeposit,
    regularDeposit: latest.length ? round(sum(latest.map(d => num(d['TOTAL-HAFKADA'])))) : null,
    insuredSalary: cover ? num(cover['SACHAR-KOVEA-LE-NECHUT-VE-SHEERIM']) : null,
    expectedAnnuity: annuity.some(a => a != null) ? round(sum(annuity)) : null,
    tracks: [...byTrack].map(([name, t]) => ({
      name, balance: round(t.balance), share: tracksTotal ? round(t.balance / tracksTotal * 100) : 0,
      // the clearing house gives one net return per track for the report period, not the 7 standard periods
      returns: [null, null, null, null, null, null, null], periodReturn: t.periodReturn,
    })),
    coverages,
    coverageCost: cover ? { disability: num(cover['ALUT-KISUI-NECHUT']) ?? 0, survivors: num(cover['ALUT-KISUY-SHEERIM']) ?? 0 } : undefined,
    deposits: [...deposits.values()].sort((a, b) => a.valueDate.localeCompare(b.valueDate))
      .map(d => [d.valueDate, d.month, d.salary, round(d.employee), round(d.employer), round(d.severance), round(d.total)]),
    periodReturn: num(list(policy.Tsua)[0]?.['SHEUR-TSUA-NETO']),
    feesCharged: charged.length ? {
      fromDeposits: round(sum(charged.map(c => num(c['TOTAL-DMEI-NIHUL-HAFKADA'])))),
      fromBalance: round(sum(charged.map(c => num(c['TOTAL-DMEI-NIHUL-TZVIRA'])))),
    } : undefined,
  };
}

/** Build a pension report from the clearing house XML files of one person. */
export function reportFromMislaka(files: { name: string; xml: string }[], member: string): Report & { skipped: string[] } {
  const products: Product[] = [];
  const skipped: string[] = [];
  let asOf = '';
  for (const f of files) {
    const doc = parser.parse(f.xml) as Node;
    const root = (doc.Mimshak ?? doc) as Node;
    for (const yatzran of list(root.YeshutYatzran)) {
      const provider = str(yatzran['SHEM-YATZRAN']) ?? '—';
      for (const mutzar of all(yatzran, 'Mutzarim/Mutzar')) {
        for (const policy of all(mutzar, 'HeshbonotOPolisot/HeshbonOPolisa')) {
          const p = product(provider, mutzar, policy);
          if (!p) { skipped.push(`${f.name}: ${str(policy['SHEM-TOCHNIT']) ?? '?'} (סוג מוצר ${String(at(mutzar, 'NetuneiMutzar/SUG-MUTZAR'))})`); continue; }
          products.push(p);
          const d = date(policy['TAARICH-NECHONUT']);
          if (d && d > asOf) asOf = d;
        }
      }
    }
  }
  if (!products.length) throw new Error('no pension products found in the files');
  const totalSavings = round(sum(products.map(p => p.balance)));
  const breakdown = (key: (p: Product) => string) => [...products.reduce((m, p) => m.set(key(p), (m.get(key(p)) ?? 0) + p.balance), new Map<string, number>())]
    .map(([name, amount]) => ({ name, amount: round(amount), pct: totalSavings ? round(amount / totalSavings * 100) : 0 }));
  const active = products.filter(p => p.status === 'active');
  const deposits = (type: Product['type']) => round(sum(active.filter(p => p.type === type).map(p => p.regularDeposit ?? null)));
  return {
    asOf, member, source: 'מסלקה פנסיונית (XML)',
    summary: {
      totalSavings,
      byProductType: breakdown(p => PRODUCT_LABELS[p.type]),
      byProvider: breakdown(p => p.provider),
      monthlyDeposits: { pension: deposits('pension'), keren_hishtalmut: deposits('keren_hishtalmut'), kupat_gemel: deposits('kupat_gemel'),
        total: round(sum(active.map(p => p.regularDeposit ?? null))) },
    },
    products, skipped,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
  const member = flag('--member');
  const out = flag('--out');
  if (!member || !args.length) {
    console.error('usage: npm run import:mislaka -- --member <name> [--out report.json] <folder or .xml files>');
    process.exit(1);
  }
  const paths = args.flatMap(p => statSync(p).isDirectory()
    ? readdirSync(p).filter(f => f.toLowerCase().endsWith('.xml')).map(f => join(p, f)) : [p]);
  const { skipped, ...report } = reportFromMislaka(paths.map(p => ({ name: p.split('/').pop()!, xml: readFileSync(p, 'utf8') })), member);
  if (out) writeFileSync(out, JSON.stringify(report, null, 2));
  for (const s of skipped) console.log(`  skipped (not a savings product): ${s}`);
  const result = importPensionReport(getDb(), report);
  console.log(`Imported ${report.products.length} products as of ${report.asOf}:`, result);
}
