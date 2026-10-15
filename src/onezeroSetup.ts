import { randomUUID } from 'node:crypto';
import { chmodSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { ACCOUNTS_FILE } from './config.js';

const configSchema = z.object({
  accounts: z.array(z.object({
    companyId: z.string(),
    credentials: z.record(z.unknown()),
  }).passthrough()),
}).passthrough();
const phoneSchema = z.string().trim().regex(/^\+972[1-9]\d{7,8}$/);
const codeSchema = z.string().trim().regex(/^\d+$/);
const triggerSchema = z.object({ success: z.literal(true) });
const tokenSchema = z.object({
  success: z.literal(true),
  longTermTwoFactorAuthToken: z.string().trim().min(1),
});
type SetupConfig = z.infer<typeof configSchema>;

export class OneZeroSetupError extends Error {
  constructor(readonly stage: 'config' | 'phone' | 'code' | 'trigger' | 'token') {
    super('One Zero setup failed. Check the config and try again.');
    this.name = 'OneZeroSetupError';
  }
}

type TokenScraper = {
  readonly triggerTwoFactorAuth: (phone: string) => Promise<unknown>;
  readonly getLongTermTwoFactorToken: (code: string) => Promise<unknown>;
};
export type SetupInteraction = {
  readonly question: (prompt: string) => Promise<string>;
  readonly createScraper: () => TokenScraper | Promise<TokenScraper>;
};
export type SetupOutput = {
  readonly success: (message: string) => void;
  readonly failure: (message: string) => void;
};

function readSetupConfig(file: string): SetupConfig {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const result = configSchema.safeParse(parsed);
  if (!result.success) throw new OneZeroSetupError('config');
  const matches = result.data.accounts.filter(account => account.companyId === 'oneZero');
  if (matches.length !== 1) throw new OneZeroSetupError('config');
  return result.data;
}

export async function setupOneZero(interaction: SetupInteraction, file = ACCOUNTS_FILE): Promise<void> {
  const target = realpathSync(file);
  readSetupConfig(target);
  const phone = phoneSchema.safeParse(await interaction.question('One Zero phone (+972..., input hidden): '));
  if (!phone.success) throw new OneZeroSetupError('phone');
  const scraper = await interaction.createScraper();
  const trigger = await scraper.triggerTwoFactorAuth(phone.data);
  if (!triggerSchema.safeParse(trigger).success) throw new OneZeroSetupError('trigger');
  const code = codeSchema.safeParse(await interaction.question('SMS OTP (input hidden): '));
  if (!code.success) throw new OneZeroSetupError('code');
  const token = tokenSchema.safeParse(await scraper.getLongTermTwoFactorToken(code.data));
  if (!token.success) throw new OneZeroSetupError('token');

  const latest = readSetupConfig(target);
  const updated = {
    ...latest,
    accounts: latest.accounts.map(account => account.companyId === 'oneZero'
      ? { ...account, credentials: { ...account.credentials, otpLongTermToken: token.data.longTermTwoFactorAuthToken } }
      : account),
  };
  const temporary = join(dirname(target), `.onezero-${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, `${JSON.stringify(updated, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    chmodSync(temporary, 0o600);
    renameSync(temporary, target);
  } finally {
    rmSync(temporary, { force: true });
  }
}

export async function runOneZeroSetup(
  interaction: SetupInteraction,
  output: SetupOutput,
  file = ACCOUNTS_FILE,
): Promise<boolean> {
  try {
    await setupOneZero(interaction, file);
    output.success('One Zero token saved. Keep the accounts file private.');
    return true;
  } catch {
    output.failure('One Zero setup failed or was cancelled. Check the config and try again.');
    return false;
  }
}

async function main(): Promise<void> {
  if (process.argv.slice(2).includes('--help')) {
    console.log('Usage: npm run setup:onezero\nRequires exactly one oneZero entry with credentials in accounts.json (ACCOUNTS_FILE overrides).\nPrompts for an international +972 phone and SMS OTP, then saves otpLongTermToken with permissions 0600.');
    return;
  }
  if (process.argv.length > 2 || !process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('Use an interactive terminal, or npm run setup:onezero -- --help.');
    process.exitCode = 1;
    return;
  }
  const output = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const terminal = createInterface({ input: process.stdin, output, terminal: true });
  const cancellation = new AbortController();
  terminal.on('SIGINT', () => cancellation.abort());
  terminal.on('close', () => cancellation.abort());
  try {
    const succeeded = await runOneZeroSetup({
      question: async prompt => {
        process.stdout.write(prompt);
        const answer = await terminal.question('', { signal: cancellation.signal });
        process.stdout.write('\n');
        return answer;
      },
      createScraper: async () => {
        process.env.DEBUG = '';
        const { createScraper, CompanyTypes } = await import('israeli-bank-scrapers');
        return createScraper({ companyId: CompanyTypes.oneZero, startDate: new Date(), verbose: false });
      },
    }, {
      success: message => console.log(message),
      failure: message => console.error(message),
    });
    if (!succeeded) process.exitCode = 1;
  } finally {
    terminal.close();
    output.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
