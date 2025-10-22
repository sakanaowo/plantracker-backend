import { IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateTaskDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsNumber() position?: number;
}
