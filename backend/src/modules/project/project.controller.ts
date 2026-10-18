import { Controller, Post, Get, Patch, Put, Body, Param, Query, UseGuards, Req, UnauthorizedException, ForbiddenException, Optional } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { ProjectClosureService } from './project-closure.service';
import { CreateWbsDto } from './dto/create-wbs.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ClaimCharterDto } from './dto/claim-charter.dto';
import { ProgressClaimDto } from './dto/progress-claim.dto';
import { UpdateTaskProgressDto } from './dto/update-task-progress.dto';
import { VerifyProgressDto } from './dto/verify-progress.dto';
import { SaveWbsTreeDto } from './dto/save-wbs-tree.dto';
import { SaveCostEstimateDto } from './dto/save-cost-estimate.dto';
import { SaveProjectScheduleDto } from './dto/save-project-schedule.dto';
import { SaveInitialConditionDto } from './dto/save-initial-condition.dto';
import { DecideManagementReviewDto } from './dto/decide-management-review.dto';
import { AssignPmDto } from './dto/assign-pm.dto';
import { GetProjectMasterQueryDto } from './dto/get-project-master.dto';
import {
  SubmitClosureDto,
  ApproveClosureDto,
  ReturnClosureDto,
} from './dto/closure-workflow.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Project')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['project', 'projects'])
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    @Optional() private readonly projectClosureService?: ProjectClosureService,
  ) {}

  @Get('master')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'DIRECTOR',
    'GENERAL_MANAGER',
    'HEAD_OF_OPERATIONS',
    'PMO',
    'PROJECT_MANAGER',
    'PROCUREMENT',
    'PURCHASING',
    'FINANCE',
    'LEGAL',
    'MARKETING',
    'MARKETING_MANAGER',
  )
  @ApiOperation({ summary: 'Get Project Master authoritative directory projection' })
  async getProjectMaster(
    @Query() query: GetProjectMasterQueryDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('User identity is required');
    }
    const rawRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const userRoles: string[] = (Array.isArray(rawRoles) ? rawRoles : [rawRoles]).map((r: any) =>
      typeof r === 'string' ? r : r?.name || String(r),
    );
    return this.projectService.getProjectMaster(query, Number(userId), userRoles);
  }

  @Get('master/:projectId')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'DIRECTOR',
    'GENERAL_MANAGER',
    'HEAD_OF_OPERATIONS',
    'PMO',
    'PROJECT_MANAGER',
    'PROCUREMENT',
    'PURCHASING',
    'FINANCE',
    'LEGAL',
    'MARKETING',
    'MARKETING_MANAGER',
  )
  @ApiOperation({ summary: 'Get Project Master single detail projection with authoritative readiness' })
  async getProjectMasterDetail(
    @Param('projectId') projectId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('User identity is required');
    }
    const rawRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const userRoles: string[] = (Array.isArray(rawRoles) ? rawRoles : [rawRoles]).map((r: any) =>
      typeof r === 'string' ? r : r?.name || String(r),
    );
    return this.projectService.getProjectMasterDetail(Number(projectId), Number(userId), userRoles);
  }

  @Get('operational-board')
  @Roles(
    'PROJECT_MANAGER',
    'PMO',
    'DIRECTOR',
    'GENERAL_MANAGER',
    'HEAD_OF_OPERATIONS',
    'SUPER_ADMIN',
    'PROCUREMENT',
    'PURCHASING',
  )
  @ApiOperation({ summary: 'Get official PMO operational board (Pending kickoff and active projects)' })
  async getOperationalBoard(@Req() req: any) {
    const userId =
      req.user?.userId ??
      req.user?.id ??
      req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('User identity is required');
    }

    const rawRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const userRoles: string[] = (Array.isArray(rawRoles) ? rawRoles : [rawRoles]).map((r: any) =>
      typeof r === 'string' ? r : r?.name || String(r),
    );
    return this.projectService.getOperationalBoard(Number(userId), userRoles);
  }

  @Get('eligible-pms')
  @Roles('PMO')
  @ApiOperation({ summary: 'Get list of active eligible Project Managers for PM assignment (PMO only)' })
  async getEligibleProjectManagers() {
    return this.projectService.getEligibleProjectManagers();
  }

  @Post(':projectId/assign-pm')
  @Roles('PMO')
  @ApiOperation({ summary: 'PMO assigns an eligible Project Manager to a project/contract' })
  async assignPm(
    @Param('projectId') projectId: string,
    @Body() dto: AssignPmDto,
    @Req() req: any,
  ) {
    const actorUserId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!actorUserId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.assignProjectManager(
      projectId,
      dto.projectManagerId,
      Number(actorUserId),
      userRoles,
    );
  }

  @Post('wbs')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new WBS item' })
  async createWbs(@Body() createWbsDto: CreateWbsDto, @Req() req: any) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.createWbs(createWbsDto, Number(userId), userRoles);
  }

  @Get(':projectId/wbs')
  @ApiOperation({ summary: 'Get all WBS items for a specific project' })
  async getWbsByProject(@Param('projectId') projectId: number, @Req() req?: any) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.getWbsByProject(Number(projectId), userId ? Number(userId) : undefined, userRoles);
  }

  @Put(':projectId/wbs-tree')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Save hierarchical WBS tree structure with 100% weight validation' })
  async saveWbsTree(
    @Param('projectId') projectId: number,
    @Body() saveWbsTreeDto: SaveWbsTreeDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.saveWbsTree(Number(projectId), saveWbsTreeDto, Number(userId), userRoles);
  }

  @Get(':projectId/cost-estimate')
  @ApiOperation({ summary: 'Get canonical Cost Estimate (RAB) for a project' })
  async getCostEstimate(@Param('projectId') projectId: number, @Req() req?: any) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.getCostEstimate(Number(projectId), userId ? Number(userId) : undefined, userRoles);
  }

  @Put(':projectId/cost-estimate')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Save atomic Cost Estimate (RAB) for a project' })
  async saveCostEstimate(
    @Param('projectId') projectId: number,
    @Body() saveCostEstimateDto: SaveCostEstimateDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.saveCostEstimate(
      Number(projectId),
      saveCostEstimateDto,
      Number(userId),
      userRoles,
    );
  }

  @Get(':projectId/schedule')
  @ApiOperation({ summary: 'Get canonical Project Schedule & Gantt data' })
  async getProjectSchedule(@Param('projectId') projectId: number, @Req() req?: any) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.getProjectSchedule(Number(projectId), userId ? Number(userId) : undefined, userRoles);
  }

  // -------------------- Baseline (P6.6-3) --------------------
  @Get(':projectId/baseline')
  @ApiOperation({ summary: 'Get active baseline metadata and overall progress' })
  async getProjectBaseline(
    @Param('projectId') projectId: number,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    
    return this.projectService.getProjectActiveBaseline(
      Number(projectId),
      userId,
      userRoles,
    );
  }

  // -------------------- Progress History / Ledger (P6.6-2) --------------------
  @Get(':projectId/progress-logs')
  @ApiOperation({ summary: 'Get progress history / ledger for a project' })
  async getProgressLogs(
    @Param('projectId') projectId: number,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    
    return this.projectService.getProgressLogs(
      Number(projectId),
      userId,
      userRoles,
    );
  }

  @Get(':projectId/task-board')
  @ApiOperation({ summary: 'Get authoritative project task board read model (Kanban workspace)' })
  async getProjectTaskBoard(
    @Param('projectId') projectId: number,
    @Req() req?: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.getProjectTaskBoard(
      Number(projectId),
      userId ? Number(userId) : undefined,
      userRoles,
    );
  }

  @Get(':projectId/progress-monitoring')
  @ApiOperation({ summary: 'Get authoritative project progress and monitoring read model (Project Control & S-Curve)' })
  async getProjectProgressMonitoring(
    @Param('projectId') projectId: number,
    @Query('asOf') asOf?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.getProjectProgressMonitoring(
      Number(projectId),
      userId ? Number(userId) : undefined,
      userRoles,
      asOf,
    );
  }

  @Get(':projectId/gantt')
  @ApiOperation({ summary: 'Get authoritative Gantt Baseline vs Actual schedule control workspace read model' })
  async getProjectGantt(
    @Param('projectId') projectId: number,
    @Query('asOf') asOf?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.getProjectGantt(
      Number(projectId),
      userId ? Number(userId) : undefined,
      userRoles,
      asOf,
    );
  }

  @Patch(':projectId/tasks/:taskId/progress')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update routine task progress after formal kickoff' })
  async updateTaskProgress(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskProgressDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.updateTaskProgress(Number(projectId), Number(taskId), dto, Number(userId), userRoles);
  }

  // -------------------- Critical Progress Claim Endpoint (P6.5-B2) --------------------
  @Post(':projectId/tasks/:taskId/progress-claims')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Submit critical or downward progress claim' })
  async createProgressClaim(
    @Param('projectId') projectId: number,
    @Param('taskId') taskId: number,
    @Body() claimDto: ProgressClaimDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.createProgressClaim(
      Number(projectId),
      Number(taskId),
      claimDto,
      Number(userId),
      userRoles,
    );
  }

  // -------------------- Verification Endpoint (P6.5-B2) --------------------
  @Post(':projectId/progress-logs/:logId/verify')
  @Roles('PMO', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Verify a pending progress claim' })
  async verifyProgressLog(
    @Param('projectId') projectId: number,
    @Param('logId') logId: number,
    @Body() verifyDto: VerifyProgressDto,
    @Req() req: any,
  ) {
    const verifierId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!verifierId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const verifierRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.verifyProgressLog(
      Number(projectId),
      Number(logId),
      verifyDto.decision,
      verifyDto.rejectionReason || null,
      Number(verifierId),
      verifierRoles,
    );
  }

  @Put(':projectId/schedule')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Save atomic Project Schedule & Gantt data' })
  async saveProjectSchedule(
    @Param('projectId') projectId: number,
    @Body() saveProjectScheduleDto: SaveProjectScheduleDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.saveProjectSchedule(
      Number(projectId),
      saveProjectScheduleDto,
      Number(userId),
      userRoles,
    );
  }

  @Get(':projectId/operational-readiness')
  @ApiOperation({ summary: 'Get canonical operational plan readiness evaluation for a project (WBS, Cost, Schedule SSOT)' })
  async getOperationalReadiness(@Param('projectId') projectId: number, @Req() req?: any) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.getOperationalReadiness(Number(projectId), userId ? Number(userId) : undefined, userRoles);
  }

  @Post('tasks')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Legacy: Create a single Task under a WBS' })
  async createTask(@Body() createTaskDto: CreateTaskDto, @Req() req: any) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.createTask(createTaskDto, Number(userId), userRoles);
  }

  @Post(':projectId/kickoff')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Formal Kick-off: Transition project from PLANNING to IN_PROGRESS' })
  async formalKickoff(
    @Param('projectId') projectId: number,
    @Body() body: ClaimCharterDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.executeFormalKickoff(
      Number(projectId),
      body,
      Number(userId),
      userRoles,
    );
  }

  @Get('wbs/:wbsId/tasks')
  @ApiOperation({ summary: 'Legacy: Get all tasks for a specific WBS' })
  async getTasksByWbs(@Param('wbsId') wbsId: number) {
    return this.projectService.getTasksByWbs(wbsId);
  }

  @Patch('charters/:id/claim')
  @Roles('PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Deprecated: Legacy self-claim endpoint (rejects fail-closed)' })
  async claimCharterPatch(@Param('id') id: string, @Body() body: ClaimCharterDto, @Req() req: any) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const roles = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.claimCharter(id, body, Number(userId), roles);
  }

  @Post('charters/:id/claim')
  @Roles('PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Deprecated: Legacy self-claim endpoint (rejects fail-closed)' })
  async claimCharterPost(@Param('id') id: string, @Body() body: ClaimCharterDto, @Req() req: any) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const roles = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.claimCharter(id, body, Number(userId), roles);
  }

  @Patch('charters/:id/reject')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Reject and return a project charter back to marketing for revision' })
  async rejectCharterPatch(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.rejectCharter(id, body, Number(userId), userRoles);
  }

  @Post('charters/:id/reject')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Reject and return a project charter back to marketing for revision' })
  async rejectCharterPost(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.rejectCharter(id, body, Number(userId), userRoles);
  }

  @Patch('charters/:id/resubmit')
  @Roles('MARKETING', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Resubmit a PM-returned project charter back to PMO kickoff queue' })
  async resubmitCharterPatch(@Param('id') id: string, @Req() req: any) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.resubmitCharter(id, Number(userId), userRoles);
  }

  @Post('charters/:id/resubmit')
  @Roles('MARKETING', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Resubmit a PM-returned project charter back to PMO kickoff queue' })
  async resubmitCharterPost(@Param('id') id: string, @Req() req: any) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.resubmitCharter(id, Number(userId), userRoles);
  }

  // INITIAL CONDITION (R11.1.5-C2)

  @Get(':projectId/initial-condition')
  @ApiOperation({ summary: 'Get canonical Initial Condition baseline for a project' })
  async getInitialCondition(@Param('projectId') projectId: number) {
    return this.projectService.getInitialCondition(Number(projectId));
  }

  @Put(':projectId/initial-condition')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Save or update canonical Initial Condition baseline for a project' })
  async saveInitialCondition(
    @Param('projectId') projectId: number,
    @Body() saveInitialConditionDto: SaveInitialConditionDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.saveInitialCondition(
      Number(projectId),
      saveInitialConditionDto,
      Number(userId),
      userRoles,
    );
  }

  // MANAGEMENT REVIEW / PROCUREMENT GATE (R11.1.5-C2)

  @Get(':projectId/management-review')
  @ApiOperation({ summary: 'Get canonical Management Review / Procurement Gate record for a project' })
  async getManagementReview(@Param('projectId') projectId: number) {
    return this.projectService.getManagementReview(Number(projectId));
  }

  @Post(':projectId/management-review/submit')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Submit Project Operational Plan for Management Review (Requires 4/4 Technical Pillars READY)' })
  async submitManagementReview(
    @Param('projectId') projectId: number,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.submitManagementReview(
      Number(projectId),
      Number(userId),
      userRoles,
    );
  }

  @Post(':projectId/management-review/decide')
  @Roles('HEAD_OF_OPERATIONS', 'GENERAL_MANAGER', 'DIRECTOR', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Decide Management Review: Approve (READY_FOR_PROCUREMENT) or Request Revision (NEEDS_REVISION)' })
  async decideManagementReview(
    @Param('projectId') projectId: number,
    @Body() decideDto: DecideManagementReviewDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    const userRoles: string[] = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    return this.projectService.decideManagementReview(
      Number(projectId),
      decideDto,
      Number(userId),
      userRoles,
    );
  }

  @Post(':projectId/management-review/repair')
  @Roles('SUPER_ADMIN', 'PMO', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'One-time idempotent repair for out-of-sync Management Review projection from Workflow Engine SSOT' })
  async repairManagementReviewProjection(
    @Param('projectId') projectId: number,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub || 1;
    return this.projectService.repairManagementReviewProjection(Number(projectId), Number(userId));
  }

  // ==============================================================
  // PROJECT CLOSURE READ-ONLY ENDPOINTS (R1-C2)
  // ==============================================================

  @Get(':projectId/closure-readiness')
  @Roles(
    'PROJECT_MANAGER',
    'HEAD_OF_OPERATIONS',
    'DIRECTOR',
    'PMO',
    'GENERAL_MANAGER',
    'SUPER_ADMIN',
    'PROCUREMENT',
    'FINANCE',
  )
  @ApiOperation({ summary: 'Evaluate project closure readiness (Pure Read-Only)' })
  async getClosureReadiness(
    @Param('projectId') projectId: number | string,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    const rawRoles = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    const userRoles: string[] = (Array.isArray(rawRoles) ? rawRoles : [rawRoles]).map((r: any) =>
      typeof r === 'string' ? r : r?.name || String(r),
    );
    return this.projectClosureService!.evaluateClosureReadiness(
      Number(projectId),
      userId ? Number(userId) : undefined,
      userRoles,
    );
  }

  @Get(':projectId/closure/current')
  @Roles('PROJECT_MANAGER', 'HEAD_OF_OPERATIONS', 'DIRECTOR', 'PMO', 'GENERAL_MANAGER')
  @ApiOperation({ summary: 'Get current Project Closure cycle and workflow orchestration status' })
  async getCurrentClosure(
    @Param('projectId') projectId: number | string,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    const rawRoles = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    const userRoles: string[] = (Array.isArray(rawRoles) ? rawRoles : [rawRoles]).map((r: any) =>
      typeof r === 'string' ? r : r?.name || String(r),
    );
    return this.projectClosureService!.getCurrentClosure(
      Number(projectId),
      userId ? Number(userId) : undefined,
      userRoles,
    );
  }

  @Get(':projectId/closure/history')
  @Roles('PROJECT_MANAGER', 'HEAD_OF_OPERATIONS', 'DIRECTOR', 'PMO', 'GENERAL_MANAGER')
  @ApiOperation({ summary: 'Get all Project Closure historical cycles' })
  async getClosureHistory(
    @Param('projectId') projectId: number | string,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    const rawRoles = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    const userRoles: string[] = (Array.isArray(rawRoles) ? rawRoles : [rawRoles]).map((r: any) =>
      typeof r === 'string' ? r : r?.name || String(r),
    );
    return this.projectClosureService!.getClosureHistory(
      Number(projectId),
      userId ? Number(userId) : undefined,
      userRoles,
    );
  }

  // ==============================================================
  // PROJECT CLOSURE WORKFLOW ENDPOINTS (R1-C3)
  // ==============================================================

  @Post(':projectId/closure/submit')
  @Roles('PROJECT_MANAGER')
  @ApiOperation({ summary: 'PM Submit Project Closure (Initiates cycle and workflow)' })
  async submitClosure(
    @Param('projectId') projectId: number | string,
    @Body() dto: SubmitClosureDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    const rawRoles = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    const userRoles: string[] = (Array.isArray(rawRoles) ? rawRoles : [rawRoles]).map((r: any) =>
      typeof r === 'string' ? r : r?.name || String(r),
    );
    return this.projectClosureService!.submitClosure(
      Number(projectId),
      dto,
      Number(userId),
      userRoles,
    );
  }

  @Post(':projectId/closure/:closureId/hoo/approve')
  @Roles('HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'HOO Approve Project Closure' })
  async hooApprove(
    @Param('projectId') projectId: number | string,
    @Param('closureId') closureId: number | string,
    @Body() dto: ApproveClosureDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    const rawRoles = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    const userRoles: string[] = (Array.isArray(rawRoles) ? rawRoles : [rawRoles]).map((r: any) =>
      typeof r === 'string' ? r : r?.name || String(r),
    );
    return this.projectClosureService!.hooApprove(
      Number(projectId),
      Number(closureId),
      dto,
      Number(userId),
      userRoles,
    );
  }

  @Post(':projectId/closure/:closureId/hoo/return')
  @Roles('HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'HOO Return Project Closure' })
  async hooReturn(
    @Param('projectId') projectId: number | string,
    @Param('closureId') closureId: number | string,
    @Body() dto: ReturnClosureDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    const rawRoles = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    const userRoles: string[] = (Array.isArray(rawRoles) ? rawRoles : [rawRoles]).map((r: any) =>
      typeof r === 'string' ? r : r?.name || String(r),
    );
    return this.projectClosureService!.hooReturn(
      Number(projectId),
      Number(closureId),
      dto,
      Number(userId),
      userRoles,
    );
  }

  @Post(':projectId/closure/:closureId/director/approve')
  @Roles('DIRECTOR')
  @ApiOperation({ summary: 'Director Final Approve Project Closure' })
  async directorApprove(
    @Param('projectId') projectId: number | string,
    @Param('closureId') closureId: number | string,
    @Body() dto: ApproveClosureDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    const rawRoles = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    const userRoles: string[] = (Array.isArray(rawRoles) ? rawRoles : [rawRoles]).map((r: any) =>
      typeof r === 'string' ? r : r?.name || String(r),
    );
    return this.projectClosureService!.directorApprove(
      Number(projectId),
      Number(closureId),
      dto,
      Number(userId),
      userRoles,
    );
  }

  @Post(':projectId/closure/:closureId/director/return')
  @Roles('DIRECTOR')
  @ApiOperation({ summary: 'Director Return Project Closure' })
  async directorReturn(
    @Param('projectId') projectId: number | string,
    @Param('closureId') closureId: number | string,
    @Body() dto: ReturnClosureDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId || req?.user?.id || req?.user?.sub;
    if (!userId) throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    const rawRoles = req?.user?.roles || (req?.user?.role ? [req.user.role] : []);
    const userRoles: string[] = (Array.isArray(rawRoles) ? rawRoles : [rawRoles]).map((r: any) =>
      typeof r === 'string' ? r : r?.name || String(r),
    );
    return this.projectClosureService!.directorReturn(
      Number(projectId),
      Number(closureId),
      dto,
      Number(userId),
      userRoles,
    );
  }
}


