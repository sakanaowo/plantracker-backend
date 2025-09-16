import { IsEnum, IsUUID } from 'class-validator';
import { role } from '@prisma/client';

export class AddMemberDto {
  @IsUUID()
  userId: string;

  @IsEnum(role)
  role!: role; //owner | admin | member
}
