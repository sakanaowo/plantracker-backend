import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateChecklistDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  title!: string;
}
