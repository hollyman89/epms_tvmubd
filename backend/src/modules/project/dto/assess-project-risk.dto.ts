import { IsInt, Min, Max } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AssessProjectRiskDto {
  @ApiProperty({ description: "Authoritative expected version", example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiProperty({
    description: "Probability on 1..5 scale",
    example: 3,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  probability: number;

  @ApiProperty({
    description: "Impact on 1..5 scale",
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  impact: number;
}
