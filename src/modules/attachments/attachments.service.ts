import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { RequestAttachmentUploadDto } from './dto/request-attachment-upload.dto';
import {
  ATTACHMENT_LIMITS,
  isAllowedFileType,
  isValidFileSize,
} from '../../common/constants';
import { createClient } from '@supabase/supabase-js';
import slugify from 'slugify';

@Injectable()
export class AttachmentsService {
  private supabase: ReturnType<typeof createClient>;
  private bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    this.supabase = createClient(url, key, { auth: { persistSession: false } });
    this.bucket = process.env.SUPABASE_BUCKET!;
  }

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

    // Create signed upload URL via Supabase
    // ✅ FIX: Use the actual path returned by Supabase (not generateStoragePath)
    const {
      path: storagePath,
      signedUrl,
      token,
    } = await this.createSignedUploadUrl(userId, dto.fileName);

    // Pre-create attachment record with the ACTUAL storage path
    const attachment = await this.prisma.attachments.create({
      data: {
        task_id: taskId,
        url: storagePath,
        mime_type: dto.mimeType,
        size: dto.size,
        uploaded_by: userId,
      },
    });
    console.log(
      `✅ Created attachment record: ${attachment.id} for task ${taskId}`,
    );
    console.log(`   Storage path: ${storagePath}`);
    console.log(
      `   File: ${dto.fileName}, Size: ${dto.size}, Type: ${dto.mimeType}`,
    );

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

    console.log(`📎 Listing attachments for task: ${taskId}`);
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
    console.log(`📎 Found ${attachments.length} attachments`);
    attachments.forEach((att, idx) => {
      console.log(
        `   ${idx + 1}. ID: ${att.id}, File: ${this.extractFileName(att.url)}, Size: ${att.size}`,
      );
    });

    // Map to include file name from URL and convert to full public URL
    return attachments.map((attachment) => ({
      id: attachment.id,
      taskId: attachment.task_id,
      url: this.getPublicUrl(attachment.url), // ✅ Convert to full public URL
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
    const { signedUrl } = await this.createSignedViewUrl(attachment.url);

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
      await this.remove(attachment.url);
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

  // ========== Supabase Storage Methods (moved from StorageService) ==========

  /**
   * Generate safe storage path for file
   */
  private safePath(userId: string, fileName: string): string {
    const ext = fileName.includes('.') ? fileName.split('.').pop() : 'jpg';
    const base = fileName.replace(/\.[^/.]+$/, '');
    const name = slugify(base, { lower: true, strict: true });
    return `${userId}/uploads/${Date.now()}-${name}.${ext}`;
  }

  /**
   * Create signed upload URL for file
   */
  private async createSignedUploadUrl(userId: string, fileName: string) {
    const objectPath = this.safePath(userId, fileName);
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(objectPath);
    if (error)
      throw new BadRequestException({
        statusCode: 400,
        message: error.message,
        error: 'CREATE_SIGNED_URL_FAILED',
      });
    return { path: objectPath, signedUrl: data.signedUrl, token: data.token };
  }

  /**
   * Create signed view URL for file
   */
  private async createSignedViewUrl(objectPath: string) {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(objectPath, 600);
    if (error)
      throw new BadRequestException({
        statusCode: 400,
        message: error.message,
        error: 'CREATE_SIGNED_URL_FAILED',
      });
    return { signedUrl: data.signedUrl };
  }

  /**
   * Remove file from storage
   */
  private async remove(objectPath: string) {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([objectPath]);
    if (error)
      throw new BadRequestException({
        statusCode: 400,
        message: error.message,
        error: 'DELETE_FILE_FAILED',
      });
    return { ok: true };
  }

  /**
   * Get public URL for a file in storage
   */
  private getPublicUrl(objectPath: string): string {
    const { data } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(objectPath);
    return data.publicUrl;
  }

  // ========== Helper Methods ==========

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
