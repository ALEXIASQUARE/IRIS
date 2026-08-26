import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';

@Controller('incidents')
export class IncidentsController {
  constructor(private incidents: IncidentsService) {}

  @Post()
  report(@Body() dto: CreateIncidentDto, @CurrentUser() user: { id: string }) {
    return this.incidents.report(dto, user.id);
  }

  @Get()
  listOwn(@CurrentUser() user: { id: string }) {
    return this.incidents.listOwn(user.id);
  }
}
