import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const TASK_STATUSES = [
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'BLOCKED',
  'CANCELLED',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export class TaskItemDto {
  @ApiProperty({
    example: 101,
    description: 'Task ID (Kosongkan jika membuat task baru)',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  id?: number;

  @ApiProperty({
    example: 1,
    description: 'Project ID (Server route adalah otoritas utama)',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  projectId?: number;

  @ApiProperty({
    example: 20,
    description: 'WBS Deliverable Node ID (Wajib leaf node)',
  })
  @IsNumber()
  wbsId: number;

  @ApiProperty({
    example: 'Survey Jalur Fiber Optic',
    description: 'Nama aktivitas pekerjaan / deliverable',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: false,
    description: 'Flag penanda milestone (titik pencapaian tanpa durasi)',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isMilestone?: boolean;

  @ApiProperty({
    example: 'TASK',
    description: 'Canonical type compatibility ("TASK" | "MILESTONE")',
    required: false,
  })
  @IsString()
  @IsOptional()
  type?: 'TASK' | 'MILESTONE';

  @ApiProperty({
    example: '2026-09-01',
    description: 'Tanggal mulai (YYYY-MM-DD)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate harus berformat YYYY-MM-DD',
  })
  startDate?: string;

  @ApiProperty({
    example: '2026-09-10',
    description: 'Tanggal selesai (YYYY-MM-DD)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate harus berformat YYYY-MM-DD',
  })
  endDate?: string;

  @ApiProperty({
    example: 5,
    description: 'Durasi hari kalender (Server authoritative)',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  duration?: number;

  @ApiProperty({
    example: 100,
    description: 'Predecessor Task ID',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  predecessorTaskId?: number | null;

  @ApiProperty({
    example: '1.1',
    description: 'Predecessor WBS Code untuk compatibility frontend',
    required: false,
  })
  @IsString()
  @IsOptional()
  predecessorWbsCode?: string;

  @ApiProperty({
    example: 'FS',
    description: 'Tipe dependensi (Hanya FS Finish-to-Start)',
    default: 'FS',
    required: false,
  })
  @IsString()
  @IsOptional()
  dependencyType?: string;

  @ApiProperty({
    example: 0.0,
    description: 'Progres penyelesaian task (0.00 - 100.00)',
    default: 0.0,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  progress?: number;

  @ApiProperty({
    example: 'PLANNED',
    description: 'Status perencanaan / pengerjaan task',
    enum: TASK_STATUSES,
    default: 'PLANNED',
    required: false,
  })
  @IsEnum(TASK_STATUSES, {
    message: `status harus salah satu dari: ${TASK_STATUSES.join(', ')}`,
  })
  @IsOptional()
  status?: string;

  @ApiProperty({
    example: 2,
    description: 'User ID penanggung jawab (Assignee)',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  assigneeId?: number | null;
}

export class SaveProjectScheduleDto {
  @ApiProperty({
    type: [TaskItemDto],
    description: 'Daftar aktivitas jadwal proyek',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskItemDto)
  tasks: TaskItemDto[];

  @ApiProperty({
    example: 'Jadwal operasional awal disetujui PM',
    description: 'Catatan tambahan PM terkait jadwal kerja',
    required: false,
  })
  @IsString()
  @IsOptional()
  pmNotes?: string;
}
