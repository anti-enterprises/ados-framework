import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

  it('verifies the retained-skill contract when the shared harness is installed', () => {
    const home = mkdtempSync(join(tmpdir(), 'ados-harness-check-'));
    const bin = join(home, '.local', 'bin');
    mkdirSync(bin, { recursive: true });
    for (const name of ['harness-doctor', 'harness-catalog']) {
      const target = join(bin, name);
      writeFileSync(target, '#!/usr/bin/env bash\nexit 0\n');
      chmodSync(target, 0o755);
    }
    const search = join(bin, 'harness-search');
    writeFileSync(search, `#!/usr/bin/env bash
printf '%s\\n' '[
  {"id": "anti:router:growth-marketing"},
  {"id": "anti:router:design-production"},
  {"id": "anti:skill:anti-ai-slop"},
  {"id": "anti:library:product-marketing"},
  {"id": "anti:library:setup-gbrain"}
]'
`);
    chmodSync(search, 0o755);
    const env = { ...process.env, HOME: home, PATH: `${bin}:/usr/bin:/bin` };
    const result = spawnSync(script, ['--strict'], { encoding: 'utf8', env });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('retained-skill compatible');
    rmSync(home, { recursive: true, force: true });
  });

  it('reports retained-skill incompatibility when catalog search fails', () => {
    const home = mkdtempSync(join(tmpdir(), 'ados-harness-check-'));
    const bin = join(home, '.local', 'bin');
    mkdirSync(bin, { recursive: true });
    for (const name of ['harness-doctor', 'harness-catalog']) {
      const target = join(bin, name);
      writeFileSync(target, '#!/usr/bin/env bash\nexit 0\n');
      chmodSync(target, 0o755);
    }
    const search = join(bin, 'harness-search');
    writeFileSync(search, `#!/usr/bin/env bash
if [[ " $* " == *" planner "* ]]; then
  printf '%s\\n' '[]'
  exit 0
fi
exit 2
`);
    chmodSync(search, 0o755);
    const env = { ...process.env, HOME: home, PATH: `${bin}:/usr/bin:/bin` };
    const result = spawnSync(script, ['--strict'], { encoding: 'utf8', env });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('lacks the retained-skill contract');
    expect(result.stderr).toContain('Shared harness search failed');
    rmSync(home, { recursive: true, force: true });
  });
});
