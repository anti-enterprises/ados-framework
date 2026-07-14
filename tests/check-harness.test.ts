import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve('bin/check-harness');

describe('bin/check-harness', () => {
  it('is optional by default and fails closed in strict mode', () => {
    const home = mkdtempSync(join(tmpdir(), 'ados-harness-check-'));
    const env = { ...process.env, HOME: home, PATH: '/usr/bin:/bin' };
    const optional = spawnSync(script, [], { encoding: 'utf8', env });
    const strict = spawnSync(script, ['--strict'], { encoding: 'utf8', env });

    expect(optional.status).toBe(0);
    expect(optional.stdout).toContain('Shared ECC harness unavailable');
    expect(strict.status).toBe(1);
    rmSync(home, { recursive: true, force: true });
  });
});
