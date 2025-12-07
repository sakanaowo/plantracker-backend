import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
