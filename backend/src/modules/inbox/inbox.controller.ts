import { Controller, Get, UseGuards, Request, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InboxService } from './inbox.service';

@ApiTags('Inbox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inbox')
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get('todos')
  @ApiOperation({ summary: 'Get all pending actionable tasks for current authenticated user' })
  @ApiResponse({ status: 200, description: 'Actionable tasks retrieved successfully.' })
  async getMyTodos(@Request() req: any) {
    const userId = Number(req.user?.userId ?? req.user?.id ?? req.user?.sub);
    const rawRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const roles: string[] = rawRoles.map((r: any) =>
      typeof r === 'string' ? r : r?.name || String(r),
    );

    const data = await this.inboxService.getTodos(userId, roles);

    return {
      statusCode: HttpStatus.OK,
      message: 'Pending actionable tasks retrieved successfully',
      data,
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get historical completed workflow and domain tasks for current authenticated user' })
  @ApiResponse({ status: 200, description: 'Historical tasks retrieved successfully.' })
  async getMyHistory(@Request() req: any) {
    const userId = Number(req.user?.userId ?? req.user?.id ?? req.user?.sub);
    const rawRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const roles: string[] = rawRoles.map((r: any) =>
      typeof r === 'string' ? r : r?.name || String(r),
    );

    const data = await this.inboxService.getHistory(userId, roles);

    return {
      statusCode: HttpStatus.OK,
      message: 'Historical workflow tasks retrieved successfully',
      data,
    };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get Unified Inbox count summary (todos vs unread notifications)' })
  @ApiResponse({ status: 200, description: 'Inbox summary retrieved successfully.' })
  async getSummary(@Request() req: any) {
    const userId = Number(req.user?.userId ?? req.user?.id ?? req.user?.sub);
    const rawRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const roles: string[] = rawRoles.map((r: any) =>
      typeof r === 'string' ? r : r?.name || String(r),
    );

    const data = await this.inboxService.getSummary(userId, roles);

    return {
      statusCode: HttpStatus.OK,
      message: 'Inbox summary retrieved successfully',
      data,
    };
  }
}
