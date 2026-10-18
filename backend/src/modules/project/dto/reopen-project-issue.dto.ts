import { IsString, IsNotEmpty, IsInt, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ReopenProjectIssueDto {
  @ApiProperty({ description: "Authoritative expected version", example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiProperty({ description: "Reason for reopening the issue" })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
