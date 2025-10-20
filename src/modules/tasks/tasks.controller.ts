import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { CreateQuickTaskDto } from './dto/create-quick-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { tasks } from '@prisma/client';
import { CurrentUser } from '../../auth/current-user.decorator';

@Controller('tasks')
export class TasksController {
  constructor(private readonly svc: TasksService) {}

  @Get('by-board/:boardId')
  list(
    @Param('boardId', new ParseUUIDPipe()) boardId: string,
  ): Promise<tasks[]> {
    return this.svc.listByBoard(boardId);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<tasks | null> {
    return this.svc.getById(id);
  }

  @Post()
  create(@Body() dto: CreateTaskDto): Promise<tasks> {
    return this.svc.create(dto);
  }

  @Post('quick')
  createQuick(
    @Body() dto: CreateQuickTaskDto,
    @CurrentUser('id') userId: string,
  ): Promise<tasks> {
    return this.svc.createQuickTask(userId, dto);
  }

  @Post(':id/move')
  move(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MoveTaskDto,
  ): Promise<tasks> {
    return this.svc.move(id, dto.toBoardId, dto.beforeId, dto.afterId);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<tasks> {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<tasks> {
    return this.svc.softDelete(id);
  }
}
