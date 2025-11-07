import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
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
    @CurrentUser('id') userId: string,
  ): Promise<tasks> {
    return this.svc.move(id, dto.toBoardId, dto.beforeId, dto.afterId, userId);
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
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<tasks> {
    return this.svc.softDelete(id, userId);
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

  // ==================== ASSIGNEES ====================

  @Get(':taskId/assignees')
  getAssignees(@Param('taskId', new ParseUUIDPipe()) taskId: string) {
    return this.svc.getAssignees(taskId);
  }

  @Post(':taskId/assignees')
  assignUsers(
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() dto: { userIds: string[] },
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.assignUsers(taskId, dto.userIds, userId);
  }

  @Delete(':taskId/assignees/:userId')
  unassignUser(
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Param('userId', new ParseUUIDPipe()) assigneeUserId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.unassignUser(taskId, assigneeUserId, userId);
  }

  @Delete(':taskId/assignees')
  unassignAll(
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.unassignAll(taskId, userId);
  }

  // ==================== CALENDAR SYNC ====================
  // TODO [TONIGHT]: Test task calendar sync with FE
  // 1. Enable reminder → Check event created in Google Calendar
  // 2. Update task → Check calendar event updated
  // 3. Disable reminder → Check event deleted from calendar

  @Put(':id/calendar-sync')
  async updateCalendarSync(
    @Param('id', new ParseUUIDPipe()) taskId: string,
    @Body()
    dto: {
      calendarReminderEnabled: boolean;
      calendarReminderTime?: number;
      title?: string;
      dueAt?: string;
    },
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.updateTaskWithCalendarSync(userId, taskId, {
      calendarReminderEnabled: dto.calendarReminderEnabled,
      calendarReminderTime: dto.calendarReminderTime,
      title: dto.title,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
    });
  }

  // TODO [TONIGHT]: Test calendar view with FE
  // - Filter tasks by date range
  // - Check calendar_event_id is returned
  // - Verify tasks show in FE calendar view
  @Get('calendar')
  async getTasksForCalendar(
    @Query('projectId') projectId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.svc.getTasksForCalendar(
      projectId,
      new Date(startDate),
      new Date(endDate),
    );
  }
}
