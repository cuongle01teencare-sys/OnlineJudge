import Anthropic from '@anthropic-ai/sdk';
import type { ConfigService } from '@nestjs/config';

/**
 * Shared access to the Claude API for infrastructure adapters (exam reader, test suggester, AI-usage reviewer).
 * Disabled when ANTHROPIC_API_KEY is not configured; adapters then fall back or skip.
 */
export class ClaudeClient {
  constructor(
    readonly api: Anthropic | null,
    /** Model per task: reading an exam needs more care than reviewing one submission. */
    readonly models: { examReader: string; testCases: string; aiUsageReview: string },
  ) {}

  get enabled(): boolean {
    return this.api !== null;
  }

  /**
   * Model plus the server-side refusal fallback (on a policy decline the API retries
   * the request on a suitable model). Haiku has no server-side fallback, so it gets none.
   */
  static target(model: string): {
    model: string;
    betas?: Anthropic.Beta.AnthropicBeta[];
    fallbacks?: Anthropic.Beta.Messages.BetaFallbacksParam;
  } {
    if (model.startsWith('claude-haiku')) return { model };
    return { model, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
  }
}

export function createClaudeClient(config: ConfigService): ClaudeClient {
  const apiKey = config.get<string>('ANTHROPIC_API_KEY');
  return new ClaudeClient(apiKey ? new Anthropic({ apiKey, maxRetries: 2 }) : null, {
    examReader: config.get<string>('CLAUDE_MODEL') || 'claude-sonnet-5-5',
    testCases: config.get<string>('CLAUDE_TESTGEN_MODEL') || config.get<string>('CLAUDE_MODEL') || 'claude-sonnet-5-5',
    aiUsageReview: config.get<string>('CLAUDE_REVIEW_MODEL') || 'claude-haiku-5-5',
  });
}
