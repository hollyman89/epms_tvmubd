import { Controller, Post, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { CreateWbsDto } from './dto/create-wbs.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Project')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get('operational-board')
  @ApiOperation({ summary: 'Get official PMO operational board (Pending kickoff and active projects)' })
  async getOperationalBoard() {
    return this.projectService.getOperationalBoard();
  }

  @Post('wbs')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new Work Breakdown Structure (WBS)' })
  async createWbs(@Body() createWbsDto: CreateWbsDto) {
    return this.projectService.createWbs(createWbsDto);
  }

  @Get(':projectId/wbs')
  @ApiOperation({ summary: 'Get all WBS for a specific project' })
  async getWbsByProject(@Param('projectId') projectId: number) {
    return this.projectService.getWbsByProject(projectId);
  }

  @Post('tasks')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new Task under a WBS' })
  async createTask(@Body() createTaskDto: CreateTaskDto) {
    return this.projectService.createTask(createTaskDto);
  }

  @Get('wbs/:wbsId/tasks')
  @ApiOperation({ summary: 'Get all tasks for a specific WBS' })
  async getTasksByWbs(@Param('wbsId') wbsId: number) {
    return this.projectService.getTasksByWbs(wbsId);
  }

  @Patch('charters/:id/claim')
  @ApiOperation({ summary: 'Claim and kickoff a project charter into active project' })
  async claimCharterPatch(@Param('id') id: string, @Body() body: any) {
    return this.projectService.claimCharter(id, body);
  }

  @Post('charters/:id/claim')
  @ApiOperation({ summary: 'Claim and kickoff a project charter into active project' })
  async claimCharterPost(@Param('id') id: string, @Body() body: any) {
    return this.projectService.claimCharter(id, body);
  }
}
