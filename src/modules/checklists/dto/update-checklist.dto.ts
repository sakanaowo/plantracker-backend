import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateChecklistDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  title?: string;
}
