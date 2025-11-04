import { ApiProperty } from '@nestjs/swagger';

export class AuthUrlResponseDto {
  @ApiProperty({
    description: 'Google OAuth authorization URL',
    example: 'https://accounts.google.com/oauth2/auth?...',
  })
  authUrl: string;
}

export class CallbackResponseDto {
  @ApiProperty({
    description: 'Success status of OAuth callback',
    example: true,
  })
  success: boolean;
}

export class SyncResponseDto {
  @ApiProperty({
    description: 'Success status of sync operation',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Status message',
    example: 'Events synced successfully',
  })
  message: string;
}

export class IntegrationStatusResponseDto {
  @ApiProperty({
    description: 'Whether Google Calendar is connected',
    example: true,
  })
  isConnected: boolean;

  @ApiProperty({
    description: 'Connected Google account email',
    example: 'user@gmail.com',
    nullable: true,
  })
  accountEmail: string | null;

  @ApiProperty({
    description: 'Last sync timestamp',
    example: '2025-11-04T12:00:00Z',
    nullable: true,
  })
  lastSyncAt: Date | null;
}
