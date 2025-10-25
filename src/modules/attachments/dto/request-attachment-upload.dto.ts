import { IsNotEmpty, IsString, IsInt, Min, Matches } from 'class-validator';

export class RequestAttachmentUploadDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @IsInt()
  @Min(1)
  size!: number; // File size in bytes
}
