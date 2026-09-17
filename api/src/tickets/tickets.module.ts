import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesModule } from '../categories/categories.module.js';
import { CountersModule } from '../counters/counters.module.js';
import { UsersModule } from '../users/users.module.js';
import { Ticket, TicketSchema } from './ticket.schema.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Ticket.name, schema: TicketSchema }]),
    // Categories for the used-category lock, counters for the ticket code,
    // users to turn ids into names on the way out.
    CategoriesModule,
    CountersModule,
    UsersModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
