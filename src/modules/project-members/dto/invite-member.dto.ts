import { IsEmail, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { project_role } from '@prisma/client';

export class InviteMemberDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsEnum(project_role)
  role?: project_role;
}
