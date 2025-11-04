import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  IsBoolean,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty({
    description: 'Project ID where the event belongs',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  projectId: string;

  @ApiProperty({
    description: 'Event title',
    example: 'Team Meeting - Sprint Planning',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Event start date and time (ISO 8601)',
    example: '2025-11-05T10:00:00Z',
  })
  @IsDateString()
  startAt: Date;

  @ApiProperty({
    description: 'Event end date and time (ISO 8601)',
    example: '2025-11-05T11:00:00Z',
  })
  @IsDateString()
  endAt: Date;

  @ApiProperty({
    description: 'Event location',
    example: 'Conference Room A',
    required: false,
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({
    description: 'Meeting link (Zoom, Google Meet, etc.)',
    example: 'https://zoom.us/j/123456789',
    required: false,
  })
  @IsOptional()
  @IsString()
  meetLink?: string;

  @ApiProperty({
    description: 'Participant email addresses',
    example: ['user1@example.com', 'user2@example.com'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantEmails?: string[];

  @ApiProperty({
    description: 'Whether to sync this event to Google Calendar',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  syncToGoogle?: boolean;
}
