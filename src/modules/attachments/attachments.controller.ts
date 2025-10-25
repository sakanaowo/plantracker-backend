import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AttachmentsService } from './attachments.service';
import { RequestAttachmentUploadDto } from './dto/request-attachment-upload.dto';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';

@ApiTags('attachments')
@Controller()
@UseGuards(CombinedAuthGuard)
@ApiBearerAuth()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  /**
   * Request upload URL for attachment (Step 1 of upload)
   */
  @Post('tasks/:taskId/attachments/upload-url')
  async requestUpload(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RequestAttachmentUploadDto,
  ) {
    return this.attachmentsService.requestUpload(taskId, userId, dto);
  }

  /**
   * List attachments for a task
   */
  @Get('tasks/:taskId/attachments')
  async listByTask(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attachmentsService.listByTask(taskId, userId);
  }

  /**
   * Get signed view URL for attachment
   */
  @Get('attachments/:attachmentId/view')
  async getViewUrl(
    @Param('attachmentId') attachmentId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attachmentsService.getViewUrl(attachmentId, userId);
  }

  /**
   * Delete attachment
   */
  @Delete('attachments/:attachmentId')
  async delete(
    @Param('attachmentId') attachmentId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attachmentsService.delete(attachmentId, userId);
  }
}
