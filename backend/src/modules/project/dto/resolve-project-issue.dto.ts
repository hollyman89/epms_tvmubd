import { IsString, IsNotEmpty, IsInt, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ResolveProjectIssueDto {
  @ApiProperty({ description: "Authoritative expected version", example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiProperty({
    description: "Detailed description of the resolution applied",
  })
  @IsString()
  @IsNotEmpty()
  resolution: string;
}
