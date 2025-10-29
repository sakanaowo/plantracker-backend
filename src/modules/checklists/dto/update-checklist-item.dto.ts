import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateChecklistItemDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  content?: string;
}
