/** Port: an isolated workspace in which untrusted code is compiled and executed. */
export interface Sandbox {
  open(options: SandboxOptions): Promise<SandboxSession>;
}

export interface SandboxOptions {
  files: { name: string; content: string }[];
  /** Hard memory cap for the whole session (problem limit + language overhead). */
  memoryLimitMb: number;
}

export interface SandboxSession {
  /** Runs a build command; no stdin, generous timeout. */
  exec(argv: string[], timeoutMs: number): Promise<ExecResult>;
  /** Runs the program once against `input`. */
  run(argv: string[], input: string, limits: RunLimits): Promise<RunResult>;
  dispose(): Promise<void>;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface RunLimits {
  timeLimitMs: number;
  memoryLimitMb: number;
}

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  /** CPU time when the sandbox can measure it, otherwise wall time. */
  timeMs: number;
  /** Peak RSS, 0 when unknown. */
  memoryKb: number;
  timedOut: boolean;
  /** Killed by the memory cap (OOM). */
  killed: boolean;
}
