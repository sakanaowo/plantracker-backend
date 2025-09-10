import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { boards } from '@prisma/client';

@Controller('boards')
export class BoardsController {
  constructor(private readonly svc: BoardsService) {}
  @Get()
  list(@Query('projectId') projectId: string): Promise<boards[]> {
    return this.svc.listByProject(projectId);
  }
  @Post()
  create(@Body() dto: CreateBoardDto): Promise<boards> {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBoardDto,
  ): Promise<boards> {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<boards> {
    return this.svc.remove(id);
  }
}
