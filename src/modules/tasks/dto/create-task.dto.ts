import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTaskDto {
  @IsString() @IsNotEmpty() projectId!: string;
  @IsString() @IsNotEmpty() boardId!: string;
  @IsString() @IsNotEmpty() title!: string;
  @IsOptional() @IsString() assigneeId?: string;
}
