import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/acting-user.decorators.js';
import { UserDto } from './user.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Public: the web app needs the list before any user is picked.
  @Public()
  @Get()
  findAll(): Promise<UserDto[]> {
    return this.usersService.findAll();
  }
}
