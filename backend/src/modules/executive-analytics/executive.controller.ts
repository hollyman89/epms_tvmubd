import { Controller, Get, Query, Request, UseGuards, Header } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EXECUTIVE_PERIODS, ExecutivePeriod } from './executive.types';
import { ExecutiveReadService } from './executive-read.service';

export class ExecutiveOverviewQuery {
  @IsOptional() @IsIn(EXECUTIVE_PERIODS)
  period:ExecutivePeriod='YEAR_TO_DATE';
}

@Controller('executive')
@UseGuards(JwtAuthGuard,RolesGuard)
@Roles('DIRECTOR','ADMIN','SUPER_ADMIN')
export class ExecutiveController {
  constructor(private readonly read:ExecutiveReadService) {}
  @Get('overview')
  @Header('Cache-Control','private, no-store')
  overview(@Query() query:ExecutiveOverviewQuery,@Request() request:any) {
    return this.read.overview(query.period,request.user);
  }
}
