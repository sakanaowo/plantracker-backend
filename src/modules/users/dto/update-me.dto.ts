import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class updateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
  // TODO: remove email update for now
  @IsOptional()
  @IsEmail()
  email?: string;
  @IsOptional()
  @IsUrl()
  avatar_url?: string;
}
