import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenderActivityDto {
  @ApiProperty({ example: 'Tolong update status kontraknya segera', description: 'The comment content' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
