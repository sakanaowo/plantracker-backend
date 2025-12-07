import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class updateMeDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;

  @IsOptional() @IsUrl() avatar_url?: string;

  @IsOptional() @IsString() @MaxLength(500) bio?: string;

  @IsOptional() @IsString() @MaxLength(100) job_title?: string;

  @IsOptional() @IsString() @MaxLength(20) phone_number?: string;
}
