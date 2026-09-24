import 'mysql2';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as dotenv from 'dotenv';

import { ProjectModule } from './project.module';
import { ProjectService } from './project.service';
import { AuditModule } from '../audit/audit.module';
import { Project } from '../../entities/project.entity';
import { User } from '../../entities/user.entity';

dotenv.config();
jest.setTimeout(60000);

describe('P6.6-2 — Progress Logs Query Test Suite', () => {
  let moduleRef: TestingModule;
  let service: ProjectService;
  let dataSource: DataSource;

  const createdProjectIds: number[] = [];
  const createdUserIds: number[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'mysql',
          host: process.env.DATABASE_HOST || '127.0.0.1',
          port: parseInt(process.env.DATABASE_PORT || '3306', 10),
          username: process.env.DATABASE_USER || 'epms_app_user',
          password: process.env.DATABASE_PASSWORD || 'Epms_App_Us3r_2026!',
          database: process.env.DATABASE_NAME || 'epms_tvmubd_db',
          entities: [__dirname + '/../../entities/**/*.entity{.ts,.js}'],
          synchronize: false,
          retryAttempts: 1,
        }),
        EventEmitterModule.forRoot(),
        ProjectModule,
        AuditModule,
      ],
    }).compile();

    await moduleRef.init();
    service = moduleRef.get<ProjectService>(ProjectService);
    dataSource = moduleRef.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  afterEach(async () => {
    if (createdProjectIds.length > 0) {
      await dataSource.query(`DELETE FROM projects WHERE id IN (${createdProjectIds.join(',')})`);
      createdProjectIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await dataSource.query(`DELETE FROM users WHERE id IN (${createdUserIds.join(',')})`);
      createdUserIds.length = 0;
    }
  });

  async function createUser(roleName: string): Promise<User> {
    const userRepo = dataSource.getRepository(User);
    const user = userRepo.create({
      email: `test_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`,
      passwordHash: 'dummy',
      fullName: `Test ${roleName}`,
      isActive: true,
    });
    const savedUser = await userRepo.save(user);
    createdUserIds.push(savedUser.id);
    return savedUser;
  }

  async function createProject(managerId: number): Promise<Project> {
    const projectRepo = dataSource.getRepository(Project);
    const project = projectRepo.create({
      code: `PRJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: `Test Project ${Date.now()}`,
      managerId,
      status: 'IN_PROGRESS',
    });
    const savedProject = await projectRepo.save(project);
    createdProjectIds.push(savedProject.id);
    return savedProject;
  }

  it('1. should throw BadRequestException if projectId is invalid', async () => {
    await expect(service.getProgressLogs(0)).rejects.toThrow(BadRequestException);
    await expect(service.getProgressLogs(NaN)).rejects.toThrow(BadRequestException);
  });

  it('2. should throw NotFoundException if project does not exist', async () => {
    await expect(service.getProgressLogs(999999)).rejects.toThrow(NotFoundException);
  });

  it('3. should allow SUPER_ADMIN to query logs', async () => {
    const admin = await createUser('SUPER_ADMIN');
    const project = await createProject(admin.id);
    const logs = await service.getProgressLogs(project.id, admin.id, ['SUPER_ADMIN']);
    expect(Array.isArray(logs)).toBe(true);
  });

  it('4. should allow assigned PROJECT_MANAGER to query logs', async () => {
    const pm = await createUser('PROJECT_MANAGER');
    const project = await createProject(pm.id);
    const logs = await service.getProgressLogs(project.id, pm.id, ['PROJECT_MANAGER']);
    expect(Array.isArray(logs)).toBe(true);
  });

  it('5. should forbid unassigned PROJECT_MANAGER from querying logs', async () => {
    const pmAssigned = await createUser('PROJECT_MANAGER');
    const pmUnassigned = await createUser('PROJECT_MANAGER');
    const project = await createProject(pmAssigned.id);

    await expect(service.getProgressLogs(project.id, pmUnassigned.id, ['PROJECT_MANAGER']))
      .rejects.toThrow(ForbiddenException);
  });

  it('6. should allow HEAD_OF_OPERATIONS to query logs', async () => {
    const pm = await createUser('PROJECT_MANAGER');
    const project = await createProject(pm.id);
    const hops = await createUser('HEAD_OF_OPERATIONS');
    
    const logs = await service.getProgressLogs(project.id, hops.id, ['HEAD_OF_OPERATIONS']);
    expect(Array.isArray(logs)).toBe(true);
  });
});
