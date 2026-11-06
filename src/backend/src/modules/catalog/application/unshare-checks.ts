import { Injectable } from '@nestjs/common';

/** Says why a problem must stay public (e.g. "it is in the public set X"), or null when it may go private. */
export type UnshareCheck = (problemId: string) => Promise<string | null>;

/**
 * Checks run before a public problem is made private. Other contexts register theirs through the facade
 * (Assessment: a public set may only hold public problems), so Catalog never depends on them.
 */
@Injectable()
export class UnshareChecks {
  private readonly checks: UnshareCheck[] = [];

  register(check: UnshareCheck): void {
    this.checks.push(check);
  }

  /** The first reason the problem must stay public, or null. */
  async reasonToStayPublic(problemId: string): Promise<string | null> {
    for (const check of this.checks) {
      const reason = await check(problemId);
      if (reason) return reason;
    }
    return null;
  }
}
