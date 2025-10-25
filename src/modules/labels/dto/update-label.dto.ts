import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class UpdateLabelDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6})$/, {
    message: 'Color must be a valid hex color code (e.g., #FF0000)',
  })
  color?: string;
}
