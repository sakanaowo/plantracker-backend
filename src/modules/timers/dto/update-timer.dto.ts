import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateTimerDto {
  @IsDateString() @IsOptional() startAt?: string;
  @IsDateString() @IsOptional() endAt?: string;
  @IsString() @IsOptional() note?: string;
}
