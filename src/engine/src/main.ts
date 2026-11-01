import { Queue, Worker } from 'bullmq';
import {
  JUDGE_JOBS_QUEUE,
  JUDGE_RESULTS_QUEUE,
  type JudgeJob,
  type JudgeResultMessage,
} from '@oj/contracts';
import { JudgeSubmission } from './application/judge-submission';
import { loadConfig } from './config';
import type { Sandbox } from './domain/sandbox';
import { DockerSandbox } from './infrastructure/docker-sandbox';
import { LocalSandbox } from './infrastructure/local-sandbox';

async function main() {
  const config = loadConfig();
  const connection = { url: config.redisUrl, maxRetriesPerRequest: null };

  const sandbox: Sandbox =
    config.sandbox === 'local' ? new LocalSandbox() : new DockerSandbox(config.runnerImage);
  if (config.sandbox === 'local') {
    console.warn('[engine] SANDBOX=local: submissions run WITHOUT isolation. Development only!');
  }

  const judge = new JudgeSubmission(sandbox);
  const results = new Queue<JudgeResultMessage>(JUDGE_RESULTS_QUEUE, { connection });
  const publish = (msg: JudgeResultMessage) =>
    results.add(msg.type, msg, { removeOnComplete: 1000, removeOnFail: 1000, attempts: 5, backoff: { type: 'exponential', delay: 1000 } });

  const worker = new Worker<JudgeJob>(
    JUDGE_JOBS_QUEUE,
    async (job) => {
      await publish({ type: 'started', submissionId: job.data.submissionId, judgeRun: job.data.judgeRun });
      try {
        await publish(await judge.execute(job.data));
      } catch (error) {
        console.error(`[engine] submission ${job.data.submissionId} failed`, error);
        await publish({
          type: 'finished',
          submissionId: job.data.submissionId,
          judgeRun: job.data.judgeRun,
          verdict: 'IE',
          compileOutput: error instanceof Error ? error.message : String(error),
          testResults: [],
        });
      }
    },
    { connection, concurrency: config.concurrency },
  );

  worker.on('ready', () =>
    console.log(`[engine] listening on "${JUDGE_JOBS_QUEUE}" (sandbox=${config.sandbox}, concurrency=${config.concurrency})`),
  );
  worker.on('error', (e) => console.error('[engine] worker error', e));

  const shutdown = async () => {
    await worker.close();
    await results.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
