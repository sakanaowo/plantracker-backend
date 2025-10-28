import { IsString, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum DevicePlatform {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
  WEB = 'WEB',
}

export class RegisterDeviceDto {
  @ApiProperty({ example: 'eXAMPLE_FCM_TOKEN_HERE' })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;

  @ApiProperty({ enum: DevicePlatform, example: DevicePlatform.ANDROID })
  @IsEnum(DevicePlatform)
  @IsNotEmpty()
  platform: DevicePlatform;

  @ApiProperty({ example: 'Samsung Galaxy S23', required: false })
  @IsString()
  @IsOptional()
  deviceModel?: string;

  @ApiProperty({ example: '1.0.0', required: false })
  @IsString()
  @IsOptional()
  appVersion?: string;

  @ApiProperty({ example: 'en-US', required: false })
  @IsString()
  @IsOptional()
  locale?: string;

  @ApiProperty({ example: 'Asia/Ho_Chi_Minh', required: false })
  @IsString()
  @IsOptional()
  timezone?: string;
}
