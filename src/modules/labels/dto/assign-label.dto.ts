import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignLabelDto {
  @IsUUID()
  @IsNotEmpty()
  labelId!: string;
}
