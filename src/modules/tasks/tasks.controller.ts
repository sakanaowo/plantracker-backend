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
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
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

  @Get('quick/defaults')
  getQuickTaskDefaults(@CurrentUser('id') userId: string): Promise<tasks[]> {
    return this.svc.getQuickTaskDefaults(userId);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<tasks | null> {
    return this.svc.getById(id);
  }

  @Post()
  create(
    @Body() dto: CreateTaskDto,
    @CurrentUser('id') userId: string,
  ): Promise<tasks> {
    return this.svc.create({
      ...dto,
      createdBy: userId,
    });
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
    @CurrentUser('id') userId: string,
  ): Promise<tasks> {
    return this.svc.update(id, {
      ...dto,
      updatedBy: userId,
    });
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<tasks> {
    return this.svc.softDelete(id);
  }

  // ==================== COMMENTS ====================

  @Get(':taskId/comments')
  getComments(@Param('taskId', new ParseUUIDPipe()) taskId: string) {
    return this.svc.getComments(taskId);
  }

  @Post(':taskId/comments')
  createComment(
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.createComment(taskId, userId, dto.body);
  }

  @Patch('comments/:commentId')
  updateComment(
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.updateComment(commentId, userId, dto.body);
  }

  @Delete('comments/:commentId')
  deleteComment(
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.deleteComment(commentId, userId);
  }
}
