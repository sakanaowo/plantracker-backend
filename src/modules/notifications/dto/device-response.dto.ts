import { ApiProperty } from '@nestjs/swagger';

export class DeviceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  fcmToken: string;

  @ApiProperty()
  platform: string;

  @ApiProperty({ required: false })
  deviceModel?: string;

  @ApiProperty({ required: false })
  appVersion?: string;

  @ApiProperty({ required: false })
  locale?: string;

  @ApiProperty({ required: false })
  timezone?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false })
  lastActiveAt?: Date;
}
