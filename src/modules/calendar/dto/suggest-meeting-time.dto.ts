import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SuggestMeetingTimeDto {
  @ApiProperty({
    description: 'Array of user IDs to check availability',
    example: ['user1', 'user2', 'user3'],
  })
  @IsArray()
  userIds: string[];

  @ApiProperty({
    description: 'Start date for availability check (ISO 8601)',
    example: '2025-11-08T00:00:00Z',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date for availability check (ISO 8601)',
    example: '2025-11-15T23:59:59Z',
  })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Meeting duration in minutes',
    example: 60,
    default: 60,
  })
  @IsOptional()
  @IsNumber()
  @Min(15)
  durationMinutes?: number;

  @ApiPropertyOptional({
    description: 'Number of time slots to suggest',
    example: 5,
    default: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxSuggestions?: number;

  @ApiPropertyOptional({
    description: 'Working hours start (0-23)',
    example: 9,
    default: 9,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  workingHoursStart?: number;

  @ApiPropertyOptional({
    description: 'Working hours end (0-23)',
    example: 17,
    default: 17,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  workingHoursEnd?: number;
}

export interface TimeSlot {
  start: string; // ISO 8601
  end: string; // ISO 8601
  availableUsers: string[]; // User IDs who are free
  unavailableUsers: string[]; // User IDs who are busy
  score: number; // 0-100, higher = better (more users available)
}

export interface MeetingTimeSuggestion {
  suggestions: TimeSlot[];
  totalUsersChecked: number;
  checkedRange: {
    start: string;
    end: string;
  };
}
