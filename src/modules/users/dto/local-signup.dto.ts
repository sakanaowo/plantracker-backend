import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class localSignupDto {
  @IsEmail()
  email: string;
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password: string;
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
