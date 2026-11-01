import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventPublisher } from './application/event-publisher.js';
import { MailTransport } from './application/mail-transport.js';
import { ClaudeClient, createClaudeClient } from './infrastructure/claude.js';
import { createMailTransport } from './infrastructure/mail-transports.js';
import { NestEventPublisher } from './infrastructure/nest-event-publisher.js';

@Global()
@Module({
  providers: [
    { provide: EventPublisher, useClass: NestEventPublisher },
    { provide: MailTransport, inject: [ConfigService], useFactory: createMailTransport },
    { provide: ClaudeClient, inject: [ConfigService], useFactory: createClaudeClient },
  ],
  exports: [EventPublisher, MailTransport, ClaudeClient],
})
export class SharedModule {}
