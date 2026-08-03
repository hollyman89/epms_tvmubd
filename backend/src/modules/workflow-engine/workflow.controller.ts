import { Controller, Get, Post, Param, Body, ParseIntPipe, UseGuards, Request, HttpStatus } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Workflow Engine & Admin Intervention Controls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

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
}
