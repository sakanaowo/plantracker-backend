import { IsString, IsUUID, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEventReminderDto {
  @ApiProperty({ description: 'Event ID' })
  @IsUUID()
  eventId: string;

  @ApiProperty({ description: 'Recipient user IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  recipientIds: string[];

  @ApiPropertyOptional({ description: 'Optional reminder message' })
  @IsOptional()
  @IsString()
  message?: string;
}

export class EventReminderResponseDto {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  projectId: string;
  projectName: string;
  senderName: string;
  message: string | null;
  timestamp: number;
  isRead: boolean;
}
