import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { RequestAttachmentUploadDto } from './dto/request-attachment-upload.dto';
import {
  ATTACHMENT_LIMITS,
  isAllowedFileType,
  isValidFileSize,
} from '../../common/constants';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  /**
   * Request upload URL for attachment (Step 1 of 2-step upload)
   */
  async requestUpload(
    taskId: string,
    userId: string,
    dto: RequestAttachmentUploadDto,
  ) {
    // Validate task access
    const task = await this.validateTaskAccess(taskId, userId);

    // Validate file type
    if (!isAllowedFileType(dto.mimeType)) {
      throw new BadRequestException(
        `File type ${dto.mimeType} is not allowed. Allowed types: images, documents, text files, archives`,
      );
    }

    // Validate file size
    if (!isValidFileSize(dto.size)) {
      throw new BadRequestException(
        `File size must be between 1 byte and ${ATTACHMENT_LIMITS.MAX_FILE_SIZE} bytes (10 MB)`,
      );
    }

    // Check max files per task limit
    const existingCount = await this.prisma.attachments.count({
      where: { task_id: taskId },
    });

    if (existingCount >= ATTACHMENT_LIMITS.MAX_FILES_PER_TASK) {
      throw new BadRequestException(
        `Task cannot have more than ${ATTACHMENT_LIMITS.MAX_FILES_PER_TASK} attachments`,
      );
    }

    // Generate storage path for attachment
    const storagePath = this.generateStoragePath(userId, taskId, dto.fileName);

    // Create signed upload URL via StorageService
    const { signedUrl, token } =
      await this.storageService.createSignedUploadUrl(userId, storagePath);

    // Pre-create attachment record
    const attachment = await this.prisma.attachments.create({
      data: {
        task_id: taskId,
        url: storagePath,
        mime_type: dto.mimeType,
        size: dto.size,
        uploaded_by: userId,
      },
    });

    // Log activity
    await this.activityLogsService.logAttachmentAdded({
      taskId,
      attachmentId: attachment.id,
      userId,
      workspaceId: task.projects.workspace_id,
      projectId: task.project_id,
      boardId: task.board_id,
      metadata: {
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        size: dto.size,
      },
    });

    return {
      attachmentId: attachment.id,
      uploadUrl: signedUrl,
      token,
      expiresIn: 3600, // 1 hour
    };
  }

  /**
   * List attachments for a task
   */
  async listByTask(taskId: string, userId: string) {
    // Validate task access
    await this.validateTaskAccess(taskId, userId);

    const attachments = await this.prisma.attachments.findMany({
      where: { task_id: taskId },
      include: {
        tasks: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Map to include file name from URL
    return attachments.map((attachment) => ({
      id: attachment.id,
      taskId: attachment.task_id,
      url: attachment.url,
      fileName: this.extractFileName(attachment.url),
      mimeType: attachment.mime_type,
      size: attachment.size,
      uploadedBy: attachment.uploaded_by,
      createdAt: attachment.created_at,
    }));
  }

  /**
   * Get signed view URL for attachment
   */
  async getViewUrl(attachmentId: string, userId: string) {
    const attachment = await this.prisma.attachments.findUnique({
      where: { id: attachmentId },
      include: {
        tasks: {
          include: {
            projects: {
              select: { workspace_id: true },
            },
          },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // Validate task access
    await this.validateTaskAccess(attachment.task_id, userId);

    // Generate signed view URL (600s expiry)
    const { signedUrl } = await this.storageService.createSignedViewUrl(
      attachment.url,
    );

    return {
      signedUrl,
      expiresIn: 600, // 10 minutes
      fileName: this.extractFileName(attachment.url),
      mimeType: attachment.mime_type,
      size: attachment.size,
    };
  }

  /**
   * Delete attachment
   */
  async delete(attachmentId: string, userId: string) {
    const attachment = await this.prisma.attachments.findUnique({
      where: { id: attachmentId },
      include: {
        tasks: {
          include: {
            projects: {
              select: { workspace_id: true },
            },
          },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // Check permission (uploader or admin)
    // TODO: Add admin role check
    if (attachment.uploaded_by !== userId) {
      throw new ForbiddenException('You can only delete your own attachments');
    }

    // Delete from Supabase Storage
    try {
      await this.storageService.remove(attachment.url);
    } catch (error) {
      // Log error but continue with DB deletion
      console.error('Failed to delete file from storage:', error);
    }

    // Delete DB record
    await this.prisma.attachments.delete({
      where: { id: attachmentId },
    });

    // Log activity
    await this.activityLogsService.logAttachmentRemoved({
      taskId: attachment.task_id,
      attachmentId,
      userId,
      metadata: {
        fileName: this.extractFileName(attachment.url),
        size: attachment.size,
      },
    });

    return { success: true, deletedId: attachmentId };
  }

  /**
   * Helper: Generate storage path for attachment
   * Format: {userId}/attachments/{taskId}/{timestamp}-{slug}.{ext}
   */
  private generateStoragePath(
    userId: string,
    taskId: string,
    fileName: string,
  ): string {
    const timestamp = Date.now();
    const ext = fileName.includes('.') ? fileName.split('.').pop() : 'bin';
    const baseName = fileName.replace(/\.[^/.]+$/, '');

    // Slugify base name (simple version)
    const slug = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `${userId}/attachments/${taskId}/${timestamp}-${slug}.${ext}`;
  }

  /**
   * Helper: Extract file name from storage path
   */
  private extractFileName(url: string): string {
    const parts = url.split('/');
    const fileNameWithTimestamp = parts[parts.length - 1];

    // Remove timestamp prefix (e.g., "1234567890-file.pdf" -> "file.pdf")
    const match = fileNameWithTimestamp.match(/^\d+-(.+)$/);
    return match ? match[1] : fileNameWithTimestamp;
  }

  /**
   * Helper: Validate task exists and user has access
   */
  private async validateTaskAccess(taskId: string, userId: string) {
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
      include: {
        projects: {
          include: {
            workspaces: {
              include: {
                memberships: {
                  where: { user_id: userId },
                },
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.projects.workspaces.memberships.length === 0) {
      throw new ForbiddenException('Access denied to this task');
    }

    return task;
  }
}
