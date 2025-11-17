import {
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { priority, issue_type, issue_status } from '@prisma/client';

export class UpdateTaskDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() position?: number;

  // Date fields
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsDateString() startAt?: string;

  // Calendar sync fields
  @IsOptional() @IsBoolean() calendarReminderEnabled?: boolean;
  @IsOptional() @IsNumber() calendarReminderTime?: number;

  // Enum fields
  @IsOptional() @IsEnum(priority) priority?: priority;
  @IsOptional() @IsEnum(issue_type) type?: issue_type;
  @IsOptional() @IsEnum(issue_status) status?: issue_status;

  // Sprint/Epic/Parent relationships
  @IsOptional() @IsString() sprintId?: string;
  @IsOptional() @IsString() epicId?: string;
  @IsOptional() @IsString() parentTaskId?: string;

  // Story points and estimates
  @IsOptional() @IsNumber() storyPoints?: number;
  @IsOptional() @IsNumber() originalEstimateSec?: number;
  @IsOptional() @IsNumber() remainingEstimateSec?: number;
}
