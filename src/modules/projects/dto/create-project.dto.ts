import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  workspaceId!: string; // ✅ camelCase - Frontend sends this

  @IsOptional()
  @IsString()
  @Length(2, 10)
  @Matches(/^[A-Z][A-Z0-9]*$/)
  key?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
