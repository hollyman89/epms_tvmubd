import { IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignPmDto {
  @ApiProperty({
    description: 'ID of the eligible Project Manager to assign to the project/contract',
    example: 12,
  })
  @IsNotEmpty({ message: 'projectManagerId is required' })
  @IsNumber({}, { message: 'projectManagerId must be a number' })
  @IsPositive({ message: 'projectManagerId must be a positive number' })
  projectManagerId: number;
}
