import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { project_type } from '@prisma/client';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 10)
  @Matches(/^[A-Z][A-Z0-9]*$/)
  key?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(project_type)
  type?: project_type; // Can update project from PERSONAL to TEAM or vice versa
}
