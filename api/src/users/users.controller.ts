import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserDto } from './dto/user.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'No valid token: log in first' })
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** List the users, requesters first, to show names next to tickets (any user) */
  @Get()
  findAll(): Promise<UserDto[]> {
    return this.usersService.findAll();
  }
}
