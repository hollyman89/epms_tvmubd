import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Request,
  HttpStatus,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowDefinitionService } from './workflow-definition.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  CreateWorkflowDefinitionDto,
  CreateWorkflowVersionDto,
} from './dto/workflow-definition.dto';
import {
  StartWorkflowInstanceDto,
  CompleteWorkflowTaskDto,
} from './dto/workflow-engine.dto';

@ApiTags('Workflow Engine & Admin Intervention Controls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workflow')
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly workflowDefinitionService: WorkflowDefinitionService,
    private readonly workflowEngineService: WorkflowEngineService,
  ) {}

  // RUNTIME WORKFLOW ENGINE APIS

  @Post('instances')
  @ApiOperation({ summary: 'Start a new workflow instance from active published version' })
  async startInstance(@Body() dto: StartWorkflowInstanceDto, @Request() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    const instance = await this.workflowEngineService.startInstance(dto, userId);
    return {
      statusCode: HttpStatus.CREATED,
      message: `Workflow instance #${instance.id} started successfully.`,
      data: instance,
    };
  }

  @Get('instances/:id')
  @ApiOperation({ summary: 'Get workflow instance details with tasks and transitions' })
  async getInstance(@Param('id', ParseIntPipe) id: number) {
    const instance = await this.workflowEngineService.getInstance(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Workflow instance retrieved successfully.',
      data: instance,
    };
  }

  @Get('instances/:id/transitions')
  @ApiOperation({ summary: 'Get workflow instance transition history' })
  async getTransitions(@Param('id', ParseIntPipe) id: number) {
    const transitions = await this.workflowEngineService.getTransitions(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Workflow transitions retrieved successfully.',
      data: transitions,
    };
  }

  @Get('instances/entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Get active workflow instance for a specific entity (e.g. PURCHASE_REQUEST)' })
  async getInstanceByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    const instance = await this.workflowEngineService.getInstanceByEntity(entityType, entityId);
    return {
      statusCode: HttpStatus.OK,
      message: instance ? 'Workflow instance retrieved successfully.' : 'No active workflow instance found.',
      data: instance,
    };
  }

  @Post('instances/:id/tasks/:taskId/complete')
  @ApiOperation({ summary: 'Complete a workflow task with a decision (APPROVE / REJECT / RETURN)' })
  async completeTask(
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: CompleteWorkflowTaskDto,
    @Request() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    const roles: string[] = req.user?.roles || [];
    const result = await this.workflowEngineService.completeTask(taskId, dto, userId, roles);
    return {
      statusCode: HttpStatus.OK,
      message: `Workflow task #${taskId} ${dto.action} successfully.`,
      data: result,
    };
  }

  @Get('tasks/mine')
  @ApiOperation({ summary: 'Get all pending tasks assigned to current user or their roles' })
  async getMyTasks(@Request() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    const roles: string[] = req.user?.roles || [];
    const tasks = await this.workflowEngineService.getMyTasks(userId, roles);
    return {
      statusCode: HttpStatus.OK,
      message: 'Pending workflow tasks retrieved successfully.',
      data: tasks,
    };
  }

  // ADMIN INTERVENTION & VISUALIZER APIS

  @Get('visualizer/:id')
  @ApiOperation({ summary: 'Fetch BPMN 2.0 XML definition, active node state, and metadata for visualizer' })
  async getWorkflowVisualizerData(@Param('id', ParseIntPipe) id: number) {
    const data = await this.workflowService.getWorkflowVisualizerData(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'BPMN visualizer data retrieved successfully',
      data,
    };
  }

  @Post('instances/:id/rollback')
  @Roles('SUPER_ADMIN', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Rollback workflow instance to a previous node state' })
  async rollbackWorkflow(
    @Param('id', ParseIntPipe) id: number,
    @Body('targetNodeId') targetNodeId: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    return await this.workflowService.rollbackWorkflow(id, targetNodeId || 'Node_Approval_PM', userId, reason);
  }

  @Post('instances/:id/reassign')
  @Roles('SUPER_ADMIN', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Reassign / Delegate workflow approval task to another user' })
  async reassignTask(
    @Param('id', ParseIntPipe) id: number,
    @Body('newApproverId', ParseIntPipe) newApproverId: number,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    const adminId = req.user?.sub || req.user?.userId;
    return await this.workflowService.reassignTask(id, newApproverId, adminId, reason);
  }

  @Post('instances/:id/override')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Emergency Admin Override (Force-approve stuck workflow node)' })
  async adminOverrideApprove(
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    const adminId = req.user?.sub || req.user?.userId;
    return await this.workflowService.adminOverrideApprove(id, adminId, reason);
  }

  // WORKFLOW DEFINITION & VERSIONING APIS

  @Post('definitions')
  @Roles('SUPER_ADMIN', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Create a new Workflow Definition' })
  async createDefinition(@Body() dto: CreateWorkflowDefinitionDto, @Request() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    return this.workflowDefinitionService.createDefinition(dto, userId);
  }

  @Get('definitions')
  @Roles('SUPER_ADMIN', 'HEAD_OF_OPERATIONS', 'PROCUREMENT', 'FINANCE', 'DIRECTOR')
  @ApiOperation({ summary: 'List all Workflow Definitions' })
  async getDefinitions(@Query('includeArchived') includeArchived?: string) {
    const include = includeArchived === 'true';
    return this.workflowDefinitionService.getDefinitions(include);
  }

  @Get('definitions/:workflowKey')
  @Roles('SUPER_ADMIN', 'HEAD_OF_OPERATIONS', 'PROCUREMENT', 'FINANCE', 'DIRECTOR')
  @ApiOperation({ summary: 'Get Workflow Definition and its versions by workflowKey' })
  async getDefinitionByKey(@Param('workflowKey') workflowKey: string) {
    return this.workflowDefinitionService.getDefinitionByKey(workflowKey);
  }

  @Delete('definitions/:keyOrId')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Hard-delete an unused DRAFT workflow definition (SUPER_ADMIN only)' })
  async deleteDefinition(@Param('keyOrId') keyOrId: string, @Request() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    const result = await this.workflowDefinitionService.deleteDefinition(keyOrId, userId);
    return {
      statusCode: HttpStatus.OK,
      message: `Workflow '${keyOrId}' deleted successfully.`,
      data: result,
    };
  }

  @Post('definitions/:keyOrId/archive')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Archive/Deactivate a workflow definition (SUPER_ADMIN only)' })
  async archiveDefinition(@Param('keyOrId') keyOrId: string, @Request() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    const result = await this.workflowDefinitionService.archiveDefinition(keyOrId, userId);
    return {
      statusCode: HttpStatus.OK,
      message: `Workflow '${keyOrId}' archived successfully.`,
      data: result,
    };
  }

  @Post('definitions/:workflowKey/versions')
  @Roles('SUPER_ADMIN', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Create a new draft version for a workflow' })
  async createVersion(
    @Param('workflowKey') workflowKey: string,
    @Body() dto: CreateWorkflowVersionDto,
    @Request() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    return this.workflowDefinitionService.createVersion(workflowKey, Object.keys(dto).length > 0 ? dto : undefined, userId);
  }

  @Get('definitions/:workflowKey/versions')
  @Roles('SUPER_ADMIN', 'HEAD_OF_OPERATIONS', 'PROCUREMENT', 'FINANCE', 'DIRECTOR')
  @ApiOperation({ summary: 'Get all versions of a workflow' })
  async getVersions(@Param('workflowKey') workflowKey: string) {
    return this.workflowDefinitionService.getVersions(workflowKey);
  }

  @Get('definitions/:workflowKey/versions/:version')
  @Roles('SUPER_ADMIN', 'HEAD_OF_OPERATIONS', 'PROCUREMENT', 'FINANCE', 'DIRECTOR')
  @ApiOperation({ summary: 'Get a specific version of a workflow' })
  async getVersion(
    @Param('workflowKey') workflowKey: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.workflowDefinitionService.getVersion(workflowKey, version);
  }

  @Post('definitions/:workflowKey/versions/:version/publish')
  @Roles('SUPER_ADMIN', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Publish a draft workflow version' })
  async publishVersion(
    @Param('workflowKey') workflowKey: string,
    @Param('version', ParseIntPipe) version: number,
    @Request() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    return this.workflowDefinitionService.publishVersion(workflowKey, version, userId);
  }

  @Put('definitions/:workflowKey/versions/:version')
  @Roles('SUPER_ADMIN', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Update a draft workflow version (Save Draft)' })
  async updateVersion(
    @Param('workflowKey') workflowKey: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() dto: CreateWorkflowVersionDto,
    @Request() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    return this.workflowDefinitionService.updateVersion(workflowKey, version, dto.bpmnJson, userId);
  }
}
