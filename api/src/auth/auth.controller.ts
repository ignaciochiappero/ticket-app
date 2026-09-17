import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserDto } from '../users/dto/user.dto.js';
import { type ActingUser, CurrentUser, Public } from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Log in and receive the token for every other request (public) */
  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiBadRequestResponse({ description: 'Missing username or password' })
  @ApiUnauthorizedResponse({ description: 'Wrong username or password' })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto.username, dto.password);
  }

  /** Who the token belongs to, so the web app can pick the views for the role */
  @Get('me')
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'No valid token: log in first' })
  me(@CurrentUser() user: ActingUser): Promise<UserDto> {
    return this.authService.currentUser(user.id);
  }
}
