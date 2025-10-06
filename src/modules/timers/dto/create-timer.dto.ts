import {
  IsDateString,
  IsOptional,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class CreateTimerDto {
  @IsString()
  @IsNotEmpty()
  taskId!: string;

  @IsDateString()
  @IsOptional()
  startAt?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
