import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateQuickTaskDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
