import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTaskDto {
  @IsString() @IsNotEmpty() projectId!: string;
  @IsString() @IsNotEmpty() boardId!: string;
  @IsString() @IsNotEmpty() title!: string;
  @IsString() @IsNotEmpty() assigneeId?: string;
}
