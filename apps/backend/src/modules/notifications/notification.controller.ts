import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('notifications')
export class NotificationController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
