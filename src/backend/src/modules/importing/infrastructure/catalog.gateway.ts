import { Injectable } from '@nestjs/common';
import type { UpsertProblemRequest, UpsertTestCaseRequest } from '@oj/contracts';
import type { Actor } from '../../../shared/application/actor.js';
import { CatalogFacade } from '../../catalog/application/catalog.facade.js';
import { ProblemCatalogGateway } from '../application/ports.js';

@Injectable()
export class CatalogFacadeGateway extends ProblemCatalogGateway {
  constructor(private readonly catalog: CatalogFacade) {
    super();
  }

  createProblem(owner: Actor, problem: UpsertProblemRequest, tests: UpsertTestCaseRequest[]) {
    return this.catalog.createProblem(owner, problem, tests);
  }
}
