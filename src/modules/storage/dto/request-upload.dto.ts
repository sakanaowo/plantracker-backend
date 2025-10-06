import { IsNotEmpty, IsString } from 'class-validator';

export class RequestUploadDto {
  @IsString() @IsNotEmpty() fileName!: string;
}
