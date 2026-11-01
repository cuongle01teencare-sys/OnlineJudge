import { Module, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from './application/account.service.js';
import { OneTimeCodes } from './application/one-time-codes.js';
import { IdentityMailer, PasswordHasher, TokenService } from './application/ports.js';
import { IdentityFacade } from './application/identity.facade.js';
import { TeamService } from './application/team.service.js';
import { UserRepository, VerificationRepository } from './domain/user.repository.js';
import { EmailIdentityMailer } from './infrastructure/email-identity-mailer.js';
import { JwtTokenService, ScryptPasswordHasher } from './infrastructure/security.js';
import { TypeOrmUserRepository, TypeOrmVerificationRepository } from './infrastructure/typeorm-user.repository.js';
import { UserOrmEntity, VerificationOrmEntity } from './infrastructure/user.orm-entity.js';
import { AuthGuard } from './presentation/auth.guard.js';
import { AuthController, UsersController } from './presentation/identity.controllers.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserOrmEntity, VerificationOrmEntity]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '7d') },
      }),
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [
    AccountService,
    TeamService,
    IdentityFacade,
    OneTimeCodes,
    { provide: UserRepository, useClass: TypeOrmUserRepository },
    { provide: VerificationRepository, useClass: TypeOrmVerificationRepository },
    { provide: PasswordHasher, useClass: ScryptPasswordHasher },
    { provide: TokenService, useClass: JwtTokenService },
    { provide: IdentityMailer, useClass: EmailIdentityMailer },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [IdentityFacade],
})
export class IdentityModule implements OnApplicationBootstrap {
  constructor(
    private readonly accounts: AccountService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.accounts.ensureAdmin(
      this.config.getOrThrow('ADMIN_EMAIL'),
      this.config.getOrThrow('ADMIN_PASSWORD'),
      this.config.get('ADMIN_NAME', 'Quản trị viên'),
    );
  }
}
