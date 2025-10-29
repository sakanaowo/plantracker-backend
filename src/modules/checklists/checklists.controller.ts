import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ChecklistsService } from './checklists.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { UpdateChecklistDto } from './dto/update-checklist.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';

@Controller()
@UseGuards(CombinedAuthGuard)
export class ChecklistsController {
  constructor(private readonly checklistsService: ChecklistsService) {}

  // ============================================================================
  // CHECKLIST ENDPOINTS
  // ============================================================================

  /**
   * GET /tasks/:taskId/checklists
   * Get all checklists for a task
   */
  @Get('tasks/:taskId/checklists')
  async getChecklistsByTask(@Param('taskId') taskId: string) {
    return this.checklistsService.getByTaskId(taskId);
  }

  /**
   * POST /tasks/:taskId/checklists
   * Create a new checklist for a task
   */
  @Post('tasks/:taskId/checklists')
  async createChecklist(
    @Param('taskId') taskId: string,
    @Body() dto: CreateChecklistDto,
    @CurrentUser() userId: string,
  ) {
    return this.checklistsService.createChecklist(taskId, dto);
  }

  /**
   * PATCH /checklists/:id
   * Update checklist title
   */
  @Patch('checklists/:id')
  async updateChecklist(
    @Param('id') checklistId: string,
    @Body() dto: UpdateChecklistDto,
    @CurrentUser() userId: string,
  ) {
    return this.checklistsService.updateChecklist(checklistId, dto);
  }

  /**
   * DELETE /checklists/:id
   * Delete a checklist (cascade deletes items)
   */
  @Delete('checklists/:id')
  async deleteChecklist(
    @Param('id') checklistId: string,
    @CurrentUser() userId: string,
  ) {
    return this.checklistsService.deleteChecklist(checklistId);
  }

  // ============================================================================
  // CHECKLIST ITEM ENDPOINTS
  // ============================================================================

  /**
   * POST /checklists/:id/items
   * Create a new checklist item
   */
  @Post('checklists/:id/items')
  async createChecklistItem(
    @Param('id') checklistId: string,
    @Body() dto: CreateChecklistItemDto,
    @CurrentUser() userId: string,
  ) {
    return this.checklistsService.createChecklistItem(checklistId, dto);
  }

  /**
   * PATCH /checklist-items/:id
   * Update checklist item content
   */
  @Patch('checklist-items/:id')
  async updateChecklistItem(
    @Param('id') itemId: string,
    @Body() dto: UpdateChecklistItemDto,
    @CurrentUser() userId: string,
  ) {
    return this.checklistsService.updateChecklistItem(itemId, dto, userId);
  }

  /**
   * PATCH /checklist-items/:id/toggle
   * Toggle checklist item done/undone
   */
  @Patch('checklist-items/:id/toggle')
  async toggleChecklistItem(
    @Param('id') itemId: string,
    @CurrentUser() userId: string,
  ) {
    return this.checklistsService.toggleChecklistItem(itemId, userId);
  }

  /**
   * DELETE /checklist-items/:id
   * Delete a checklist item
   */
  @Delete('checklist-items/:id')
  async deleteChecklistItem(
    @Param('id') itemId: string,
    @CurrentUser() userId: string,
  ) {
    return this.checklistsService.deleteChecklistItem(itemId, userId);
  }
}
