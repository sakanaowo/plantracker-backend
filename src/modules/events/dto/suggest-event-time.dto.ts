import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for requesting smart meeting time suggestions
 * Uses Google Calendar FreeBusy API to find optimal time slots
 */
export class SuggestEventTimeDto {
  @ApiProperty({
    description: 'Array of participant user IDs to check availability',
    example: ['user1-id', 'user2-id', 'user3-id'],
  })
  @IsArray()
  participantIds: string[];

  @ApiProperty({
    description: 'Start date for availability search (ISO 8601)',
    example: '2025-12-09T00:00:00Z',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date for availability search (ISO 8601)',
    example: '2025-12-16T23:59:59Z',
  })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Meeting duration in minutes',
    example: 60,
    default: 60,
    minimum: 15,
    maximum: 480,
  })
  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(480)
  durationMinutes?: number;

  @ApiPropertyOptional({
    description: 'Number of time slots to suggest',
    example: 5,
    default: 5,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxSuggestions?: number;

  @ApiPropertyOptional({
    description: 'Working hours start (0-23)',
    example: 9,
    default: 9,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(23)
  workingHoursStart?: number;

  @ApiPropertyOptional({
    description: 'Working hours end (0-23)',
    example: 18,
    default: 18,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(23)
  workingHoursEnd?: number;
}

/**
 * Response DTO for meeting time suggestions
 */
export class EventTimeSuggestionResponse {
  @ApiProperty({
    description: 'Suggested time slots sorted by score',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        start: { type: 'string', example: '2025-12-10T10:00:00Z' },
        end: { type: 'string', example: '2025-12-10T11:00:00Z' },
        availableUsers: {
          type: 'array',
          items: { type: 'string' },
          example: ['user1-id', 'user2-id'],
        },
        unavailableUsers: {
          type: 'array',
          items: { type: 'string' },
          example: ['user3-id'],
        },
        score: {
          type: 'number',
          example: 85,
          description: 'Availability score (0-100)',
        },
        scoreLabel: {
          type: 'string',
          example: 'Excellent',
          enum: ['Excellent', 'Good', 'Fair', 'Poor'],
        },
      },
    },
  })
  suggestions: TimeSlotSuggestion[];

  @ApiProperty({
    description: 'Total number of participants checked',
    example: 5,
  })
  totalParticipants: number;

  @ApiProperty({
    description: 'Number of participants with Google Calendar connected',
    example: 4,
  })
  participantsWithCalendar: number;

  @ApiProperty({
    description: 'Date range checked',
    type: 'object',
    properties: {
      start: { type: 'string' },
      end: { type: 'string' },
    },
    additionalProperties: false,
  })
  checkedRange: {
    start: string;
    end: string;
  };

  @ApiProperty({
    description: 'Recommendations for improving meeting scheduling',
    type: 'array',
    items: { type: 'string' },
  })
  recommendations: string[];
}

export interface TimeSlotSuggestion {
  start: string;
  end: string;
  availableUsers: string[];
  unavailableUsers: string[];
  score: number;
  scoreLabel: 'Excellent' | 'Good' | 'Fair' | 'Poor';
}
