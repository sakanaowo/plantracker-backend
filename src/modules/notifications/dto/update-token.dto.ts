import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTokenDto {
  @ApiProperty({ example: 'device-uuid-here' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({ example: 'new-fcm-token-here' })
  @IsString()
  @IsNotEmpty()
  newFcmToken: string;
}
