import { IsString, IsNotEmpty, IsInt, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CancelProjectIssueDto {
  @ApiProperty({ description: "Authoritative expected version", example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiProperty({ description: "Reason for cancelling the issue" })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
