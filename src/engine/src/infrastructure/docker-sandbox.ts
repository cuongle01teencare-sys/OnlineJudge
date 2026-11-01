import { randomUUID } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  ExecResult,
  RunLimits,
  RunResult,
  Sandbox,
  SandboxOptions,
  SandboxSession,
} from '../domain/sandbox';
import { runProcess } from './process';

const DOCKER_OVERHEAD_MS = 5_000;
const OUTPUT_LIMIT_KB = 64 * 1024;

/**
 * Production sandbox: one throw-away container per submission
 * (no network, capped memory/CPU/pids, unprivileged user), one `docker exec` per test.
 * Time and memory are measured inside the container with GNU time.
 */
export class DockerSandbox implements Sandbox {
  constructor(private readonly image: string) {}

  async open(options: SandboxOptions): Promise<SandboxSession> {
    const dir = await mkdtemp(join(tmpdir(), 'oj-'));
    await chmod(dir, 0o777);
    for (const file of options.files) {
      await writeFile(join(dir, file.name), file.content, { mode: 0o666 });
    }

    const name = `oj-${randomUUID().slice(0, 12)}`;
    const mem = `${options.memoryLimitMb}m`;
    const started = await runProcess(
      'docker',
      [
        'run', '-d', '--rm', '--name', name,
        '--network', 'none',
        '--cpus', '1',
        '--memory', mem, '--memory-swap', mem,
        '--pids-limit', '128',
        '--user', '65534:65534',
        '--security-opt', 'no-new-privileges',
        '-v', `${dir}:/box`, '-w', '/box',
        this.image, 'sleep', 'infinity',
      ],
      { timeoutMs: 60_000 },
    );
    if (started.exitCode !== 0) {
      await rm(dir, { recursive: true, force: true });
      throw new Error(`Cannot start sandbox container: ${started.stderr.trim()}`);
    }
    return new DockerSession(name, dir);
  }
}

class DockerSession implements SandboxSession {
  constructor(
    private readonly container: string,
    private readonly dir: string,
  ) {}

  async exec(argv: string[], timeoutMs: number): Promise<ExecResult> {
    const seconds = Math.ceil(timeoutMs / 1000);
    const r = await runProcess(
      'docker',
      ['exec', this.container, 'timeout', '-s', 'KILL', `${seconds}s`, ...argv],
      { timeoutMs: timeoutMs + DOCKER_OVERHEAD_MS },
    );
    return { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr, timedOut: r.timedOut || r.exitCode === 124 };
  }

  async run(argv: string[], input: string, limits: RunLimits): Promise<RunResult> {
    await writeFile(join(this.dir, 'input.txt'), input, { mode: 0o666 });
    // Wall clock limit is generous; TLE is decided on CPU time.
    const wallSeconds = Math.ceil((limits.timeLimitMs * 3) / 1000) + 1;
    const script =
      `ulimit -f ${OUTPUT_LIMIT_KB}; ` +
      `/usr/bin/time -f "%e %U %S %M" -o /box/.stat ` +
      `timeout -s KILL ${wallSeconds}s ${argv.map(shellQuote).join(' ')} ` +
      `< /box/input.txt > /box/output.txt 2> /box/stderr.txt`;
    const r = await runProcess('docker', ['exec', this.container, 'bash', '-c', script], {
      timeoutMs: wallSeconds * 1000 + DOCKER_OVERHEAD_MS,
    });

    const [stdout, stderr, stat] = await Promise.all([
      readFile(join(this.dir, 'output.txt'), 'utf8').catch(() => ''),
      readFile(join(this.dir, 'stderr.txt'), 'utf8').catch(() => ''),
      readFile(join(this.dir, '.stat'), 'utf8').catch(() => ''),
    ]);
    // GNU time may prefix "Command terminated by signal N"; the numbers are on the last line.
    const last = stat.trim().split('\n').pop() ?? '';
    const [wall, user, sys, rssKb] = last.split(' ').map(Number);
    const cpuMs = ((user || 0) + (sys || 0)) * 1000;
    const signalled = r.exitCode === 137 || /signal 9/.test(stat);
    const timedOut = r.timedOut || r.exitCode === 124 || (wall || 0) >= wallSeconds;

    return {
      exitCode: r.exitCode,
      stdout,
      stderr,
      timeMs: cpuMs,
      memoryKb: rssKb || 0,
      timedOut,
      killed: signalled && !timedOut,
    };
  }

  async dispose(): Promise<void> {
    await runProcess('docker', ['rm', '-f', this.container], { timeoutMs: 30_000 }).catch(() => undefined);
    await rm(this.dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function shellQuote(arg: string): string {
  return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;
}
