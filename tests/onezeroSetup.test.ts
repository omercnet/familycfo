import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OneZeroSetupError, runOneZeroSetup, setupOneZero } from '../src/onezeroSetup.js';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture(raw?: string) {
  const directory = mkdtempSync(join(tmpdir(), 'onezero-setup-'));
  directories.push(directory);
  const file = join(directory, 'custom-accounts.json');
  const config = {
    categoryApiUrl: 'https://example.invalid',
    extra: { nested: [null, true, 42] },
    accounts: [
      { companyId: 'leumi', credentials: { username: 'other', password: 'other-secret' }, custom: ['keep'] },
      { companyId: 'oneZero', credentials: { email: 'fake@example.invalid', password: 'fake-secret', otpLongTermToken: 'old', extra: { keep: true } }, member: 7 },
    ],
  };
  const original = raw ?? JSON.stringify(config);
  writeFileSync(file, original, { mode: 0o644 });
  return { file, config, original };
}

class FakeScraper {
  readonly calls: string[] = [];
  constructor(readonly result: unknown = { success: true, longTermTwoFactorAuthToken: 'new-fake-token' }) {}
  async triggerTwoFactorAuth(phone: string) {
    expect(phone).toBe('+972501234567');
    this.calls.push('trigger');
    return { success: true };
  }
  async getLongTermTwoFactorToken(code: string) {
    expect(this.calls).toEqual(['trigger']);
    expect(code).toBe('123456');
    this.calls.push('token');
    return this.result;
  }
}

function interaction(scraper = new FakeScraper()) {
  const answers = ['+972501234567', '123456'];
  return {
    question: vi.fn(async () => answers.shift() ?? ''),
    createScraper: vi.fn(() => scraper),
  };
}

describe('One Zero token setup', () => {
  it('preserves unknown fields when saving a token using one scraper instance', async () => {
    const { file, config } = fixture();
    const scraper = new FakeScraper();
    const io = interaction(scraper);

    await setupOneZero(io, file);

    const saved: unknown = JSON.parse(readFileSync(file, 'utf8'));
    expect(saved).toEqual({ ...config, accounts: config.accounts.map(account => account.companyId === 'oneZero'
      ? { ...account, credentials: { ...account.credentials, otpLongTermToken: 'new-fake-token' } } : account) });
    expect(scraper.calls).toEqual(['trigger', 'token']);
    expect(io.createScraper).toHaveBeenCalledTimes(1);
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it('preserves unrelated concurrent edits when the config changes during OTP verification', async () => {
    const { file, config } = fixture();
    const concurrent = { ...config, extra: { changed: true }, accounts: [...config.accounts].reverse() };
    const scraper = new FakeScraper();
    const io = interaction({ ...scraper, calls: scraper.calls,
      triggerTwoFactorAuth: phone => scraper.triggerTwoFactorAuth(phone),
      getLongTermTwoFactorToken: async code => {
        writeFileSync(file, JSON.stringify(concurrent));
        return scraper.getLongTermTwoFactorToken(code);
      },
    });

    await setupOneZero(io, file);

    const saved: unknown = JSON.parse(readFileSync(file, 'utf8'));
    expect(saved).toEqual({ ...concurrent, accounts: concurrent.accounts.map(account => account.companyId === 'oneZero'
      ? { ...account, credentials: { ...account.credentials, otpLongTermToken: 'new-fake-token' } } : account) });
  });

  it.each([
    'not JSON', 'null', '[]', '{}', '{"accounts":{}}',
    '{"accounts":[null]}', '{"accounts":[{"companyId":"oneZero","credentials":null}]}',
    '{"accounts":[]}', '{"accounts":[{"companyId":"leumi","credentials":{}}]}',
    '{"accounts":[{"companyId":"oneZero","credentials":{}},{"companyId":"oneZero","credentials":{}}]}',
  ])('rejects invalid or ambiguous config before SMS when input is %s', async raw => {
    const { file, original } = fixture(raw);
    const io = interaction();

    await expect(setupOneZero(io, file)).rejects.toThrow();

    expect(io.createScraper).not.toHaveBeenCalled();
    expect(io.question).not.toHaveBeenCalled();
    expect(readFileSync(file, 'utf8')).toBe(original);
  });

  it('rejects a missing file before asking for a phone or sending SMS', async () => {
    const { file } = fixture();
    const io = interaction();

    await expect(setupOneZero(io, `${file}.missing`)).rejects.toThrow();

    expect(io.createScraper).not.toHaveBeenCalled();
    expect(io.question).not.toHaveBeenCalled();
  });

  it.each([{ success: false, errorMessage: 'bank-secret' }, { success: true },
    { success: true, longTermTwoFactorAuthToken: '' }, { success: true, longTermTwoFactorAuthToken: '   ' }])(
    'leaves the file unchanged when token verification fails (%j)', async result => {
      const { file, original } = fixture();

      await expect(setupOneZero(interaction(new FakeScraper(result)), file)).rejects.toBeInstanceOf(OneZeroSetupError);

      expect(readFileSync(file, 'utf8')).toBe(original);
      expect(statSync(file).mode & 0o777).toBe(0o644);
    });

  it('leaves the file unchanged and skips OTP when triggering SMS fails', async () => {
    const { file, original } = fixture();
    const io = interaction();
    io.createScraper.mockReturnValue({ ...new FakeScraper(),
      triggerTwoFactorAuth: async () => ({ success: false }),
      getLongTermTwoFactorToken: async () => { throw new Error('must not verify'); },
    });

    await expect(setupOneZero(io, file)).rejects.toBeInstanceOf(OneZeroSetupError);

    expect(io.question).toHaveBeenCalledTimes(1);
    expect(readFileSync(file, 'utf8')).toBe(original);
  });

  it('leaves the file unchanged when the bank throws', async () => {
    const { file, original } = fixture();
    const io = interaction();
    io.createScraper.mockImplementation(() => { throw new Error('bank-secret'); });

    await expect(setupOneZero(io, file)).rejects.toThrow();

    expect(readFileSync(file, 'utf8')).toBe(original);
  });

  it('reports bank failures without exposing supplied or returned secrets', async () => {
    const { file } = fixture();
    const io = interaction();
    const secret = '+972501234567 123456 fake-secret old new-fake-token bank-response';
    io.createScraper.mockImplementation(() => { throw new Error(secret); });
    const failures: string[] = [];

    const succeeded = await runOneZeroSetup(io, {
      success: message => { throw new Error(`unexpected success: ${message}`); },
      failure: message => failures.push(message),
    }, file);

    expect(succeeded).toBe(false);
    expect(failures).toHaveLength(1);
    expect(failures.join(' ')).not.toContain(secret);
    for (const sensitiveValue of secret.split(' ')) expect(failures.join(' ')).not.toContain(sensitiveValue);
  });

  it('rejects a local phone before contacting the bank', async () => {
    const { file, original } = fixture();
    const io = interaction();
    io.question.mockResolvedValue('0501234567');

    await expect(setupOneZero(io, file)).rejects.toBeInstanceOf(OneZeroSetupError);

    expect(io.createScraper).not.toHaveBeenCalled();
    expect(readFileSync(file, 'utf8')).toBe(original);
  });

  it('revalidates the account selection when it changes before saving', async () => {
    const { file } = fixture();
    const io = interaction();
    io.question.mockImplementation(async () => {
      writeFileSync(file, '{"accounts":[]}');
      return io.question.mock.calls.length === 1 ? '+972501234567' : '123456';
    });

    await expect(setupOneZero(io, file)).rejects.toBeInstanceOf(OneZeroSetupError);

    expect(readFileSync(file, 'utf8')).toBe('{"accounts":[]}');
  });

  it('uses ACCOUNTS_FILE without reading config or contacting the bank when help is requested', () => {
    const { file, original } = fixture();

    const output = execFileSync(process.execPath, ['--import', 'tsx', 'src/onezeroSetup.ts', '--help'],
      { cwd: process.cwd(), env: { ...process.env, ACCOUNTS_FILE: `${file}.missing`, DEBUG: '*' }, encoding: 'utf8' });

    expect(output).toContain('setup:onezero');
    expect(readFileSync(file, 'utf8')).toBe(original);
  });

  it('saves to the environment-selected file when no explicit path is passed', () => {
    const { file, config } = fixture();

    execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
      const { setupOneZero } = await import('./src/onezeroSetup.ts');
      const answers = ['+972501234567', '123456'];
      await setupOneZero({
        question: async () => answers.shift(),
        createScraper: () => ({
          triggerTwoFactorAuth: async () => ({ success: true }),
          getLongTermTwoFactorToken: async () => ({ success: true, longTermTwoFactorAuthToken: 'env-fake-token' }),
        }),
      });
    `], { cwd: process.cwd(), env: { ...process.env, ACCOUNTS_FILE: file } });

    const saved: unknown = JSON.parse(readFileSync(file, 'utf8'));
    expect(saved).toEqual({ ...config, accounts: config.accounts.map(account => account.companyId === 'oneZero'
      ? { ...account, credentials: { ...account.credentials, otpLongTermToken: 'env-fake-token' } } : account) });
  });
});
