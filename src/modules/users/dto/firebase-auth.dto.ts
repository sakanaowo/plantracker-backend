import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FirebaseAuthDto {
  @ApiProperty({
    description: 'Firebase ID token from Google Sign-In',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjY4...',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
