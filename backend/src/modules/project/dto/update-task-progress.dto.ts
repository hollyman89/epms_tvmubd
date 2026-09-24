import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateTaskProgressDto {
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  progress: number;

  // The official value seen when the user opened the form.
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  expectedProgress: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
