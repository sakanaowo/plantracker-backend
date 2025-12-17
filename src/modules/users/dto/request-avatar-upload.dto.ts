import { IsNotEmpty, IsString } from 'class-validator';

export class RequestAvatarUploadDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;
}
