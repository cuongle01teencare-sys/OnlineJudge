export interface EngineConfig {
  redisUrl: string;
  concurrency: number;
  sandbox: 'docker' | 'local';
  runnerImage: string;
}

export function loadConfig(env = process.env): EngineConfig {
  const sandbox = env.SANDBOX === 'local' ? 'local' : 'docker';
  return {
    redisUrl: env.REDIS_URL ?? 'redis://localhost:6379',
    concurrency: Math.max(1, Number(env.JUDGE_CONCURRENCY ?? 2)),
    sandbox,
    runnerImage: env.RUNNER_IMAGE ?? 'oj-runner:latest',
  };
}
