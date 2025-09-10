import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MoveTaskDto {
  @IsString() @IsNotEmpty() toBoardId!: string;
  @IsString() @IsOptional() beforeId?: string;
  @IsString() @IsOptional() afterId?: string;
}
