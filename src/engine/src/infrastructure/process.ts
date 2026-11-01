import { spawn } from 'node:child_process';

export interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  wallMs: number;
}

const MAX_CAPTURE = 64 * 1024 * 1024;

/** Spawns a process, feeds stdin, captures output (capped) and kills it after `timeoutMs`. */
export function runProcess(
  command: string,
  args: string[],
  options: { cwd?: string; input?: string; timeoutMs: number },
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const started = process.hrtime.bigint();
    const child = spawn(command, args, { cwd: options.cwd, windowsHide: true });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let outSize = 0;
    let errSize = 0;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, options.timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      if (outSize < MAX_CAPTURE) out.push(chunk);
      outSize += chunk.length;
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (errSize < MAX_CAPTURE) err.push(chunk);
      errSize += chunk.length;
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? (signal ? 128 + 9 : 1),
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
        timedOut,
        wallMs: Number(process.hrtime.bigint() - started) / 1e6,
      });
    });

    // The program may exit before reading all input; ignore EPIPE.
    child.stdin.on('error', () => undefined);
    child.stdin.end(options.input ?? '');
  });
}
