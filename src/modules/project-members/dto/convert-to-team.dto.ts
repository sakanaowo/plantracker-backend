import { IsOptional, IsBoolean } from 'class-validator';

export class ConvertToTeamDto {
  @IsOptional()
  @IsBoolean()
  keepCurrentMembers?: boolean = true;
}
