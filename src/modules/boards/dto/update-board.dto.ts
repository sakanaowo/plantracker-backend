import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateBoardDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() @Min(1) order?: number;
}
