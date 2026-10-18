import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { ProjectIssueService } from "./project-issue.service";
import { ProjectRiskService } from "./project-risk.service";
import { ProjectRiskStatus } from "../../entities/project-risk.entity";
import { CreateProjectIssueDto } from "./dto/create-project-issue.dto";
import { UpdateProjectIssueDto } from "./dto/update-project-issue.dto";
import { ResolveProjectIssueDto } from "./dto/resolve-project-issue.dto";
import { ReopenProjectIssueDto } from "./dto/reopen-project-issue.dto";
import { CancelProjectIssueDto } from "./dto/cancel-project-issue.dto";
import { TransitionVersionDto } from "./dto/transition-version.dto";
import { QueryProjectIssueDto } from "./dto/query-project-issue.dto";
import { CreateProjectRiskDto } from "./dto/create-project-risk.dto";
import { UpdateProjectRiskDto } from "./dto/update-project-risk.dto";
import { AssessProjectRiskDto } from "./dto/assess-project-risk.dto";
import { MaterializeProjectRiskDto } from "./dto/materialize-project-risk.dto";
import { CancelProjectRiskDto } from "./dto/cancel-project-risk.dto";
import { QueryProjectRiskDto } from "./dto/query-project-risk.dto";

const ALL_COLLABORATIVE_ROLES = [
  "PROJECT_MANAGER",
  "PMO",
  "HEAD_OF_OPERATIONS",
  "DIRECTOR",
  "ADMIN",
  "SUPER_ADMIN",
  "PROCUREMENT",
  "PURCHASING",
  "FINANCE",
  "LEGAL",
  "MARKETING",
  "MANAGER",
  "GENERAL_MANAGER",
];

@ApiTags("Project Issues & Risks")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("project")
export class ProjectIssueRiskController {
  constructor(
    private readonly issueService: ProjectIssueService,
    private readonly riskService: ProjectRiskService,
  ) {}

  private extractActor(req: any): { userId: number; userRoles: string[] } {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException("Identitas pengguna tidak valid");
    }

    const rawRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const userRoles: string[] = (
      Array.isArray(rawRoles) ? rawRoles : [rawRoles]
    ).map((r: any) => (typeof r === "string" ? r : r?.name || String(r)));

    return { userId: Number(userId), userRoles };
  }

  @Get(":projectId/eligible-owners")
  @Roles(...ALL_COLLABORATIVE_ROLES)
  @ApiOperation({
    summary:
      "Get list of active eligible owner users for Issue & Risk assignment",
  })
  async getEligibleOwners(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.issueService.getEligibleOwners(projectId, userId, userRoles);
  }

  // =============================================================
  // PROJECT ISSUES ENDPOINTS
  // =============================================================

  @Get(":projectId/issues")
  @Roles(...ALL_COLLABORATIVE_ROLES)
  @ApiOperation({
    summary: "List project issues with pagination, filters, and owner scoping",
  })
  async getIssues(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Query() query: QueryProjectIssueDto,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.issueService.getIssues(projectId, query, userId, userRoles);
  }

  @Post(":projectId/issues")
  @Roles("PROJECT_MANAGER", "PMO")
  @ApiOperation({ summary: "Create a new project issue" })
  async createIssue(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Body() dto: CreateProjectIssueDto,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.issueService.createIssue(projectId, dto, userId, userRoles);
  }

  @Get(":projectId/issues/:issueId")
  @Roles(...ALL_COLLABORATIVE_ROLES)
  @ApiOperation({ summary: "Get project issue details" })
  async getIssueById(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("issueId", ParseIntPipe) issueId: number,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.issueService.getIssueById(
      projectId,
      issueId,
      userId,
      userRoles,
    );
  }

  @Patch(":projectId/issues/:issueId")
  @Roles("PROJECT_MANAGER", "PMO")
  @ApiOperation({
    summary: "Update project issue metadata with optimistic concurrency check",
  })
  async updateIssue(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("issueId", ParseIntPipe) issueId: number,
    @Body() dto: UpdateProjectIssueDto,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.issueService.updateIssue(
      projectId,
      issueId,
      dto,
      userId,
      userRoles,
    );
  }

  @Post(":projectId/issues/:issueId/start")
  @Roles(...ALL_COLLABORATIVE_ROLES)
  @ApiOperation({ summary: "Start issue execution (OPEN -> IN_PROGRESS)" })
  async startIssue(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("issueId", ParseIntPipe) issueId: number,
    @Body() dto: TransitionVersionDto,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.issueService.startIssue(
      projectId,
      issueId,
      dto,
      userId,
      userRoles,
    );
  }

  @Post(":projectId/issues/:issueId/resolve")
  @Roles(...ALL_COLLABORATIVE_ROLES)
  @ApiOperation({
    summary: "Resolve an issue with resolution notes (IN_PROGRESS -> RESOLVED)",
  })
  async resolveIssue(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("issueId", ParseIntPipe) issueId: number,
    @Body() dto: ResolveProjectIssueDto,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.issueService.resolveIssue(
      projectId,
      issueId,
      dto,
      userId,
      userRoles,
    );
  }

  @Post(":projectId/issues/:issueId/close")
  @Roles("PROJECT_MANAGER", "PMO", "HEAD_OF_OPERATIONS")
  @ApiOperation({ summary: "Close a resolved issue (RESOLVED -> CLOSED)" })
  async closeIssue(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("issueId", ParseIntPipe) issueId: number,
    @Body() dto: TransitionVersionDto,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.issueService.closeIssue(
      projectId,
      issueId,
      dto,
      userId,
      userRoles,
    );
  }

  @Post(":projectId/issues/:issueId/reopen")
  @Roles("PROJECT_MANAGER", "PMO", "HEAD_OF_OPERATIONS")
  @ApiOperation({
    summary: "Reopen a resolved or closed issue back to IN_PROGRESS",
  })
  async reopenIssue(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("issueId", ParseIntPipe) issueId: number,
    @Body() dto: ReopenProjectIssueDto,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.issueService.reopenIssue(
      projectId,
      issueId,
      dto,
      userId,
      userRoles,
    );
  }

  @Post(":projectId/issues/:issueId/cancel")
  @Roles("PROJECT_MANAGER", "PMO", "HEAD_OF_OPERATIONS")
  @ApiOperation({ summary: "Cancel an issue (terminal transition)" })
  async cancelIssue(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("issueId", ParseIntPipe) issueId: number,
    @Body() dto: CancelProjectIssueDto,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.issueService.cancelIssue(
      projectId,
      issueId,
      dto,
      userId,
      userRoles,
    );
  }

  // =============================================================
  // PROJECT RISKS ENDPOINTS
  // =============================================================

  @Get(":projectId/risks")
  @Roles(...ALL_COLLABORATIVE_ROLES)
  @ApiOperation({
    summary: "List project risks with pagination, filters, and owner scoping",
  })
  async getRisks(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Query() query: QueryProjectRiskDto,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.riskService.getRisks(projectId, query, userId, userRoles);
  }

  @Post(":projectId/risks")
  @Roles("PROJECT_MANAGER", "PMO")
  @ApiOperation({ summary: "Create a new project risk" })
  async createRisk(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Body() dto: CreateProjectRiskDto,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.riskService.createRisk(projectId, dto, userId, userRoles);
  }

  @Get(":projectId/risks/:riskId")
  @Roles(...ALL_COLLABORATIVE_ROLES)
  @ApiOperation({ summary: "Get project risk details" })
  async getRiskById(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("riskId", ParseIntPipe) riskId: number,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.riskService.getRiskById(projectId, riskId, userId, userRoles);
  }

  @Patch(":projectId/risks/:riskId")
  @Roles(...ALL_COLLABORATIVE_ROLES)
  @ApiOperation({
    summary:
      "Update risk metadata or mitigation plans with optimistic concurrency check",
  })
  async updateRisk(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("riskId", ParseIntPipe) riskId: number,
    @Body() dto: UpdateProjectRiskDto,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.riskService.updateRisk(
      projectId,
      riskId,
      dto,
      userId,
      userRoles,
    );
  }

  @Post(":projectId/risks/:riskId/assess")
  @Roles("PROJECT_MANAGER", "PMO")
  @ApiOperation({
    summary:
      "Assess risk probability and impact (calculates score and level server-side)",
  })
  async assessRisk(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("riskId", ParseIntPipe) riskId: number,
    @Body() dto: AssessProjectRiskDto,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.riskService.assessRisk(
      projectId,
      riskId,
      dto,
      userId,
      userRoles,
    );
  }

  @Post(":projectId/risks/:riskId/mitigate")
  @Roles("PROJECT_MANAGER", "PMO")
  @ApiOperation({
    summary:
      "Transition risk status to MITIGATING (requires non-empty mitigation plan)",
  })
  async mitigateRisk(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("riskId", ParseIntPipe) riskId: number,
    @Body() dto: TransitionVersionDto,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.riskService.transitionRiskStatus(
      projectId,
      riskId,
      ProjectRiskStatus.MITIGATING,
      dto,
      userId,
      userRoles,
    );
  }

  @Post(":projectId/risks/:riskId/monitor")
  @Roles("PROJECT_MANAGER", "PMO")
  @ApiOperation({ summary: "Transition risk status to MONITORING" })
  async monitorRisk(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("riskId", ParseIntPipe) riskId: number,
    @Body() dto: TransitionVersionDto,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.riskService.transitionRiskStatus(
      projectId,
      riskId,
      ProjectRiskStatus.MONITORING,
      dto,
      userId,
      userRoles,
    );
  }

  @Post(":projectId/risks/:riskId/materialize")
  @Roles("PROJECT_MANAGER", "PMO", "HEAD_OF_OPERATIONS")
  @ApiOperation({
    summary:
      "Materialize an assessed risk into an issue (requires actor severity and priority)",
  })
  async materializeRisk(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("riskId", ParseIntPipe) riskId: number,
    @Body() dto: MaterializeProjectRiskDto,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.riskService.materializeRisk(
      projectId,
      riskId,
      dto,
      userId,
      userRoles,
    );
  }

  @Post(":projectId/risks/:riskId/close")
  @Roles("PROJECT_MANAGER", "PMO", "HEAD_OF_OPERATIONS")
  @ApiOperation({ summary: "Close a risk (terminal transition)" })
  async closeRisk(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("riskId", ParseIntPipe) riskId: number,
    @Body() dto: TransitionVersionDto,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.riskService.closeRisk(
      projectId,
      riskId,
      dto,
      userId,
      userRoles,
    );
  }

  @Post(":projectId/risks/:riskId/cancel")
  @Roles("PROJECT_MANAGER", "PMO", "HEAD_OF_OPERATIONS")
  @ApiOperation({ summary: "Cancel a risk (terminal transition)" })
  async cancelRisk(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("riskId", ParseIntPipe) riskId: number,
    @Body() dto: CancelProjectRiskDto,
    @Req() req: any,
  ) {
    const { userId, userRoles } = this.extractActor(req);
    return this.riskService.cancelRisk(
      projectId,
      riskId,
      dto,
      userId,
      userRoles,
    );
  }
}
