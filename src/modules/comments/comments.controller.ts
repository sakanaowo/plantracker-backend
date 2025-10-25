import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';

@ApiTags('comments')
@Controller()
@UseGuards(CombinedAuthGuard)
@ApiBearerAuth()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /**
   * Create comment on task
   */
  @Post('tasks/:taskId/comments')
  async create(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(taskId, userId, dto);
  }

  /**
   * List comments of task with pagination
   */
  @Get('tasks/:taskId/comments')
  async listByTask(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @Query() query: ListCommentsQueryDto,
  ) {
    return this.commentsService.listByTask(taskId, userId, query);
  }

  /**
   * Update comment
   */
  @Patch('comments/:commentId')
  async update(
    @Param('commentId') commentId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(commentId, userId, dto);
  }

  /**
   * Delete comment
   */
  @Delete('comments/:commentId')
  async delete(
    @Param('commentId') commentId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.commentsService.delete(commentId, userId);
  }
}
