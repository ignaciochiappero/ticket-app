import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/acting-user.decorators.js';
import { UserDto } from './dto/user.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** List the seeded users you can act as, requesters first (public) */
  @Public() // The web app needs this list before any user is picked.
  @Get()
  findAll(): Promise<UserDto[]> {
    return this.usersService.findAll();
  }
}
