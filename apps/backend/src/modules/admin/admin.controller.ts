import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { BookingStatus, IncidentStatus, PartnerStatus, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { ResolveIncidentDto } from './dto/resolve-incident.dto';

@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.admin.getDashboard();
  }

  @Get('partners')
  listPartners(@Query('status') status?: PartnerStatus) {
    return this.admin.listPartners(status);
  }

  @Post('partners/:id/approve')
  approvePartner(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.admin.approvePartner(id, user.id);
  }

  @Post('partners/:id/suspend')
  suspendPartner(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.admin.suspendPartner(id, user.id);
  }

  @Get('clients')
  listClients() {
    return this.admin.listClients();
  }

  @Post('clients/:id/block')
  blockClient(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.admin.blockClient(id, user.id);
  }

  @Post('clients/:id/unblock')
  unblockClient(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.admin.unblockClient(id, user.id);
  }

  @Get('incidents')
  listIncidents(@Query('status') status?: IncidentStatus) {
    return this.admin.listIncidents(status);
  }

  @Post('incidents/:id/resolve')
  resolveIncident(
    @Param('id') id: string,
    @Body() dto: ResolveIncidentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.admin.resolveIncident(id, dto, user.id);
  }

  @Get('audit-logs')
  listAuditLogs() {
    return this.admin.listAuditLogs();
  }

  @Get('bookings')
  listBookings(
    @Query('status') status?: BookingStatus,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.listBookings({
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('bookings/:id')
  getBookingDetail(@Param('id') id: string) {
    return this.admin.getBookingDetail(id);
  }
}
