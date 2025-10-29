import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ActivityLogsService } from './activity-logs.service';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';

@ApiTags('activity-logs')
@Controller('activity-logs')
@UseGuards(CombinedAuthGuard)
@ApiBearerAuth()
export class ActivityLogsController {
  constructor(
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  /**
   * GET /activity-logs/workspace/:workspaceId
   * Get activity feed for workspace
   */
  @Get('workspace/:workspaceId')
  async getWorkspaceActivityFeed(
    @Param('workspaceId') workspaceId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.activityLogsService.getWorkspaceActivityFeed(
      workspaceId,
      limit || 100,
    );
  }

  /**
   * GET /activity-logs/project/:projectId
   * Get activity feed for project
   */
  @Get('project/:projectId')
  async getProjectActivityFeed(
    @Param('projectId') projectId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.activityLogsService.getProjectActivityFeed(
      projectId,
      limit || 100,
    );
  }

  /**
   * GET /activity-logs/task/:taskId
   * Get activity feed for task
   */
  @Get('task/:taskId')
  async getTaskActivityFeed(
    @Param('taskId') taskId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.activityLogsService.getTaskActivityFeed(taskId, limit || 50);
  }

  /**
   * GET /activity-logs/user/:userId
   * Get activity feed for user (personal activity)
   */
  @Get('user/:userId')
  async getUserActivityFeed(
    @Param('userId') userId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.activityLogsService.getUserActivityFeed(userId, limit || 50);
  }
}
