import { IsEnum, IsNotEmpty } from 'class-validator';
import { project_role } from '@prisma/client';

export class UpdateMemberRoleDto {
  @IsEnum(project_role)
  @IsNotEmpty()
  role!: project_role;
}
