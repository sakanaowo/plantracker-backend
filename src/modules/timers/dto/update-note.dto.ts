import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateNoteDto {
  @IsString()
  @IsNotEmpty()
  note!: string;
}
