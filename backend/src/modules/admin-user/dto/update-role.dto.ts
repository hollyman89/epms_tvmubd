import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsNotEmpty()
  roleId: number;
}
