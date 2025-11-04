import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class ChecklistDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  items!: string[];
}

export class CreateTaskDto {
  @IsString() @IsNotEmpty() projectId!: string;
  @IsString() @IsNotEmpty() boardId!: string;
  @IsString() @IsNotEmpty() title!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[]; // ✅ Changed to array

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistDto)
  checklists?: ChecklistDto[];
}
