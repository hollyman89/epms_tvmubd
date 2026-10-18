import { IsInt, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class TransitionVersionDto {
  @ApiProperty({ description: "Authoritative expected version", example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion: number;
}
