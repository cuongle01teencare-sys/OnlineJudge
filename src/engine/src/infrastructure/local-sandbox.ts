import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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

/**
 * DEVELOPMENT ONLY: runs code directly on the host with a timeout and no isolation.
 * Memory is not measured. Use DockerSandbox for anything students can reach.
 */
export class LocalSandbox implements Sandbox {
  async open(options: SandboxOptions): Promise<SandboxSession> {
    const dir = await mkdtemp(join(tmpdir(), 'oj-local-'));
    for (const file of options.files) {
      await writeFile(join(dir, file.name), file.content);
    }
    return new LocalSession(dir);
  }
}

const isWindows = process.platform === 'win32';

class LocalSession implements SandboxSession {
  constructor(private readonly dir: string) {}

  async exec(argv: string[], timeoutMs: number): Promise<ExecResult> {
    const [cmd, ...args] = this.resolve(argv);
    const r = await runProcess(cmd, args, { cwd: this.dir, timeoutMs }).catch(notFound(cmd));
    return { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr, timedOut: r.timedOut };
  }

  async run(argv: string[], input: string, limits: RunLimits): Promise<RunResult> {
    const [cmd, ...args] = this.resolve(argv);
    const r = await runProcess(cmd, args, {
      cwd: this.dir,
      input,
      timeoutMs: limits.timeLimitMs * 3 + 1000,
    }).catch(notFound(cmd));
    return {
      exitCode: r.exitCode,
      stdout: r.stdout,
      stderr: r.stderr,
      timeMs: r.wallMs,
      memoryKb: 0,
      timedOut: r.timedOut,
      killed: false,
    };
  }

  async dispose(): Promise<void> {
    await rm(this.dir, { recursive: true, force: true }).catch(() => undefined);
  }

  /** Maps the POSIX command names used by LanguageSpec onto the host. */
  private resolve(argv: string[]): string[] {
    const [cmd, ...args] = argv;
    if (cmd === 'python3') return [process.env.PYTHON_BIN ?? (isWindows ? 'python' : 'python3'), ...args];
    if (cmd === './main') return [join(this.dir, isWindows ? 'main.exe' : 'main'), ...args];
    return argv;
  }
}

function notFound(cmd: string) {
  return (e: NodeJS.ErrnoException) => ({
    exitCode: 127,
    stdout: '',
    stderr: e.code === 'ENOENT' ? `Không tìm thấy trình biên dịch/thông dịch "${cmd}" trên máy chấm.` : String(e),
    timedOut: false,
    wallMs: 0,
  });
}
