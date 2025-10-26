import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LabelsService } from './labels.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { AssignLabelDto } from './dto/assign-label.dto';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';

@ApiTags('labels')
@Controller()
@UseGuards(CombinedAuthGuard)
@ApiBearerAuth()
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  /**
   * Create label in project
   */
  @Post('projects/:projectId/labels')
  async create(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateLabelDto,
  ) {
    return this.labelsService.create(projectId, userId, dto);
  }

  /**
   * List all labels in project
   */
  @Get('projects/:projectId/labels')
  async listByProject(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.labelsService.listByProject(projectId, userId);
  }

  /**
   * Update label
   */
  @Patch('labels/:labelId')
  async update(
    @Param('labelId') labelId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateLabelDto,
  ) {
    return this.labelsService.update(labelId, userId, dto);
  }

  /**
   * Delete label
   */
  @Delete('labels/:labelId')
  async delete(
    @Param('labelId') labelId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.labelsService.delete(labelId, userId);
  }

  /**
   * Assign label to task
   */
  @Post('tasks/:taskId/labels')
  async assignToTask(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AssignLabelDto,
  ) {
    return this.labelsService.assignToTask(taskId, dto.labelId, userId);
  }

  /**
   * Remove label from task
   */
  @Delete('tasks/:taskId/labels/:labelId')
  async removeFromTask(
    @Param('taskId') taskId: string,
    @Param('labelId') labelId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.labelsService.removeFromTask(taskId, labelId, userId);
  }

  /**
   * Get labels of task
   */
  @Get('tasks/:taskId/labels')
  async getTaskLabels(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.labelsService.getTaskLabels(taskId, userId);
  }
}
