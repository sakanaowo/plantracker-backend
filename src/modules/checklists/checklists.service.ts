import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { checklists, checklist_items, Prisma } from '@prisma/client';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { UpdateChecklistDto } from './dto/update-checklist.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';

@Injectable()
export class ChecklistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  // ============================================================================
  // CHECKLIST OPERATIONS
  // ============================================================================

  /**
   * Get all checklists for a task (with items)
   */
  async getByTaskId(taskId: string): Promise<
    (checklists & {
      checklist_items: checklist_items[];
    })[]
  > {
    return this.prisma.checklists.findMany({
      where: { task_id: taskId },
      include: {
        checklist_items: {
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * Create a new checklist for a task
   */
  async createChecklist(
    taskId: string,
    dto: CreateChecklistDto,
  ): Promise<checklists> {
    const checklist = await this.prisma.checklists.create({
      data: {
        task_id: taskId,
        title: dto.title,
      },
    });

    // No activity log for checklist creation (only for items)
    // Checklist is just a container

    return checklist;
  }

  /**
   * Update a checklist title
   */
  async updateChecklist(
    checklistId: string,
    dto: UpdateChecklistDto,
  ): Promise<checklists> {
    const currentChecklist = await this.prisma.checklists.findUnique({
      where: { id: checklistId },
    });

    if (!currentChecklist) {
      throw new NotFoundException(`Checklist with ID ${checklistId} not found`);
    }

    const updatedChecklist = await this.prisma.checklists.update({
      where: { id: checklistId },
      data: { title: dto.title },
    });

    // No activity log for checklist title update

    return updatedChecklist;
  }

  /**
   * Delete a checklist (cascade deletes items)
   */
  async deleteChecklist(checklistId: string): Promise<checklists> {
    const checklist = await this.prisma.checklists.findUnique({
      where: { id: checklistId },
    });

    if (!checklist) {
      throw new NotFoundException(`Checklist with ID ${checklistId} not found`);
    }

    const deletedChecklist = await this.prisma.checklists.delete({
      where: { id: checklistId },
    });

    // No activity log for checklist deletion (cascade deletes items)

    return deletedChecklist;
  }

  // ============================================================================
  // CHECKLIST ITEM OPERATIONS
  // ============================================================================

  /**
   * Create a new checklist item
   */
  async createChecklistItem(
    checklistId: string,
    dto: CreateChecklistItemDto,
  ): Promise<checklist_items> {
    // Get the last item position
    const lastItem = await this.prisma.checklist_items.findFirst({
      where: { checklist_id: checklistId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const nextPosition = lastItem?.position
      ? new Prisma.Decimal(lastItem.position).plus(1024)
      : new Prisma.Decimal(1024);

    const item = await this.prisma.checklist_items.create({
      data: {
        checklist_id: checklistId,
        content: dto.content,
        position: nextPosition,
        is_done: false,
      },
    });

    // No activity log for individual item creation (too noisy)
    // Only log toggle/update/delete

    return item;
  }

  /**
   * Update a checklist item content
   */
  async updateChecklistItem(
    itemId: string,
    dto: UpdateChecklistItemDto,
    updatedBy?: string,
  ): Promise<checklist_items> {
    const currentItem = await this.prisma.checklist_items.findUnique({
      where: { id: itemId },
      include: {
        checklists: {
          select: { task_id: true, title: true },
        },
      },
    });

    if (!currentItem) {
      throw new NotFoundException(`Checklist item with ID ${itemId} not found`);
    }

    const updatedItem = await this.prisma.checklist_items.update({
      where: { id: itemId },
      data: { content: dto.content },
    });

    // Log item update
    if (updatedBy && dto.content && dto.content !== currentItem.content) {
      await this.activityLogsService.logChecklistUpdated({
        taskId: currentItem.checklists.task_id,
        checklistItemId: itemId,
        userId: updatedBy,
        oldContent: currentItem.content,
        newContent: dto.content,
      });
    }

    return updatedItem;
  }

  /**
   * Toggle checklist item done/undone
   */
  async toggleChecklistItem(
    itemId: string,
    toggledBy?: string,
  ): Promise<checklist_items> {
    const currentItem = await this.prisma.checklist_items.findUnique({
      where: { id: itemId },
      include: {
        checklists: {
          select: { task_id: true, title: true },
        },
      },
    });

    if (!currentItem) {
      throw new NotFoundException(`Checklist item with ID ${itemId} not found`);
    }

    const newDoneStatus = !currentItem.is_done;

    const updatedItem = await this.prisma.checklist_items.update({
      where: { id: itemId },
      data: { is_done: newDoneStatus },
    });

    // Log toggle action
    if (toggledBy) {
      if (newDoneStatus) {
        await this.activityLogsService.logChecklistChecked({
          taskId: currentItem.checklists.task_id,
          checklistItemId: itemId,
          userId: toggledBy,
          content: currentItem.content,
        });
      } else {
        await this.activityLogsService.logChecklistUnchecked({
          taskId: currentItem.checklists.task_id,
          checklistItemId: itemId,
          userId: toggledBy,
          content: currentItem.content,
        });
      }
    }

    return updatedItem;
  }

  /**
   * Delete a checklist item
   */
  async deleteChecklistItem(
    itemId: string,
    deletedBy?: string,
  ): Promise<checklist_items> {
    const item = await this.prisma.checklist_items.findUnique({
      where: { id: itemId },
      include: {
        checklists: {
          select: { task_id: true, title: true },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Checklist item with ID ${itemId} not found`);
    }

    const deletedItem = await this.prisma.checklist_items.delete({
      where: { id: itemId },
    });

    // Log item deletion
    if (deletedBy) {
      await this.activityLogsService.logChecklistDeleted({
        taskId: item.checklists.task_id,
        checklistItemId: itemId,
        userId: deletedBy,
        content: item.content,
      });
    }

    return deletedItem;
  }
}
