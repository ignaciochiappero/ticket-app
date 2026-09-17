import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsObjectIdPipe } from '@nestjs/mongoose';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type ActingUser,
  CurrentUser,
  Roles,
} from '../auth/auth.decorators.js';
import { PaginationQueryDto } from '../pagination/dto/pagination-query.dto.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { PaginatedTicketsDto } from './dto/paginated-tickets.dto.js';
import { TicketDto } from './dto/ticket.dto.js';
import { UpdateTicketDto } from './dto/update-ticket.dto.js';
import { TicketsService } from './tickets.service.js';

const TICKET_ID_PARAM = {
  name: 'id',
  description: 'Ticket id, the `id` field of a ticket (not its `TCK-` code)',
  example: '66e9b1f2a3c4d5e6f7a8b9c0',
};

@ApiTags('Tickets')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'No valid token: log in first' })
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  /** Open a ticket in an existing category (requesters only) */
  @Roles('requester')
  @Post()
  @ApiBadRequestResponse({
    description: 'Invalid fields, or the category does not exist',
  })
  @ApiForbiddenResponse({ description: 'Agents do not open tickets' })
  create(
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: ActingUser,
  ): Promise<TicketDto> {
    return this.ticketsService.create(dto, user);
  }

  /** The board, one page at a time, newest first: your own tickets, or every ticket for an agent */
  @Get()
  @ApiBadRequestResponse({ description: 'Invalid page or limit' })
  findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: ActingUser,
  ): Promise<PaginatedTicketsDto> {
    return this.ticketsService.findAll(query, user);
  }

  /** One ticket with its full history (its requester, or any agent) */
  @Get(':id')
  @ApiParam(TICKET_ID_PARAM)
  @ApiBadRequestResponse({ description: 'Malformed id' })
  @ApiForbiddenResponse({ description: 'This ticket belongs to someone else' })
  @ApiNotFoundResponse({ description: 'Ticket not found or deleted' })
  findOne(
    @Param('id', IsObjectIdPipe) id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<TicketDto> {
    return this.ticketsService.findOne(id, user);
  }

  /** Change the title, description or category of your own open ticket */
  @Roles('requester')
  @Patch(':id')
  @ApiParam(TICKET_ID_PARAM)
  @ApiBadRequestResponse({
    description: 'Invalid fields, malformed id, or the category does not exist',
  })
  @ApiForbiddenResponse({ description: 'This ticket belongs to someone else' })
  @ApiNotFoundResponse({ description: 'Ticket not found or deleted' })
  @ApiConflictResponse({
    description: 'The ticket is no longer open, or it changed while you edited',
  })
  update(
    @Param('id', IsObjectIdPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: ActingUser,
  ): Promise<TicketDto> {
    return this.ticketsService.update(id, dto, user);
  }

  /** Take an open ticket and become its assignee (agents only) */
  @Roles('agent')
  @Post(':id/take')
  // 200, not the 201 a POST defaults to: this changes a ticket, it does not create one.
  @HttpCode(200)
  @ApiParam(TICKET_ID_PARAM)
  @ApiBadRequestResponse({ description: 'Malformed id' })
  @ApiForbiddenResponse({ description: 'Only agents work the queue' })
  @ApiNotFoundResponse({ description: 'Ticket not found or deleted' })
  @ApiConflictResponse({
    description: 'Another agent took it first, or it is not open',
  })
  take(
    @Param('id', IsObjectIdPipe) id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<TicketDto> {
    return this.ticketsService.take(id, user);
  }

  /** Put a ticket you took back in the queue, unassigned (its assignee only) */
  @Roles('agent')
  @Post(':id/release')
  // 200, not the 201 a POST defaults to: this changes a ticket, it does not create one.
  @HttpCode(200)
  @ApiParam(TICKET_ID_PARAM)
  @ApiBadRequestResponse({ description: 'Malformed id' })
  @ApiForbiddenResponse({
    description: 'This ticket is assigned to another agent',
  })
  @ApiNotFoundResponse({ description: 'Ticket not found or deleted' })
  @ApiConflictResponse({ description: 'The ticket is not in progress' })
  release(
    @Param('id', IsObjectIdPipe) id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<TicketDto> {
    return this.ticketsService.release(id, user);
  }

  /** Resolve a ticket you took. This is final: a resolved ticket does not change again */
  @Roles('agent')
  @Post(':id/resolve')
  // 200, not the 201 a POST defaults to: this changes a ticket, it does not create one.
  @HttpCode(200)
  @ApiParam(TICKET_ID_PARAM)
  @ApiBadRequestResponse({ description: 'Malformed id' })
  @ApiForbiddenResponse({
    description: 'This ticket is assigned to another agent',
  })
  @ApiNotFoundResponse({ description: 'Ticket not found or deleted' })
  @ApiConflictResponse({ description: 'The ticket is not in progress' })
  resolve(
    @Param('id', IsObjectIdPipe) id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<TicketDto> {
    return this.ticketsService.resolve(id, user);
  }

  /** Delete your own open ticket. It stays in the database, hidden from every view */
  @Roles('requester')
  @Delete(':id')
  @HttpCode(204)
  @ApiParam(TICKET_ID_PARAM)
  @ApiBadRequestResponse({ description: 'Malformed id' })
  @ApiForbiddenResponse({ description: 'This ticket belongs to someone else' })
  @ApiNotFoundResponse({ description: 'Ticket not found or already deleted' })
  @ApiConflictResponse({ description: 'The ticket is no longer open' })
  remove(
    @Param('id', IsObjectIdPipe) id: string,
    @CurrentUser() user: ActingUser,
  ): Promise<void> {
    return this.ticketsService.remove(id, user);
  }
}
