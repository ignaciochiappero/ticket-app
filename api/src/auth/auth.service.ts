import { randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UserDto } from '../users/dto/user.dto.js';
import { UsersService } from '../users/users.service.js';
import type { LoginResponseDto } from './dto/login-response.dto.js';
import { hashPassword, verifyPassword } from './password.js';

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string): Promise<LoginResponseDto> {
    const user = await this.usersService.findByUsername(username);

    // An unknown username is still checked against a throwaway hash, so both failures
    // take a similar time and answer the same: nobody can probe which usernames exist.
    const matches = await verifyPassword(
      password,
      user?.passwordHash ?? (await this.getDummyHash()),
    );
    if (!user || !matches) {
      throw new UnauthorizedException('Wrong username or password');
    }

    // Only the token: the client asks GET /auth/me for the name and role, so it never
    // has a reason to decode the token and the API stays the single source of identity.
    const token = await this.jwtService.signAsync({
      sub: user._id,
      role: user.role,
    });
    return { token };
  }

  // The token proves the id and role, but the name lives in the database, and a user
  // can be removed while their token is still valid: then the token is no longer usable.
  async currentUser(id: string): Promise<UserDto> {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new UnauthorizedException('Log in to continue');
    }
    return user;
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }
}
