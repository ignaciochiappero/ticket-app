import { PartialType } from '@nestjs/swagger';
import { CreateTicketDto } from './create-ticket.dto.js';

// Same fields and same limits, all optional: an edit sends only what changed.
// PartialType keeps the validators and the Swagger docs in step with the
// create DTO, so the two cannot drift.
export class UpdateTicketDto extends PartialType(CreateTicketDto) {}
