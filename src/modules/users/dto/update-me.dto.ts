import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class updateMeDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;

  @IsOptional() @IsUrl() avatar_url?: string;
}
