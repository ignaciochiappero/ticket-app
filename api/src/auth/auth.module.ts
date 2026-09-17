import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module.js';
import { ActingUserGuard } from './acting-user.guard.js';

// Registers ActingUserGuard globally: every route is protected unless marked @Public().
@Module({
  imports: [UsersModule],
  providers: [{ provide: APP_GUARD, useClass: ActingUserGuard }],
})
export class AuthModule {}
