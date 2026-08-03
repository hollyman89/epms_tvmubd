import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { Project } from '../../entities/project.entity';
import { Contract } from '../../entities/contract.entity';

import { ProjectEventListener } from './project-event.listener';

@Module({
  imports: [TypeOrmModule.forFeature([WorkBreakdownStructure, Task, Project, Contract])],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectEventListener],
  exports: [ProjectService],
})
export class ProjectModule {}
