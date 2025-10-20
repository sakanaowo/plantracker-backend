import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { StorageService } from './storage.service';
import { ApiTags } from '@nestjs/swagger';
// import { CombinedAuthGuard } from 'src/auth/combined-auth.guard';
import { RequestUploadDto } from './dto/request-upload.dto';
import { CurrentUser } from 'src/auth/current-user.decorator';

@ApiTags('storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('upload-url')
  async makeUploadUrl(
    @CurrentUser('id') userId: string,
    @Body() dto: RequestUploadDto,
  ) {
    return this.storage.createSignedUploadUrl(userId, dto.fileName);
  }

  @Get('view-url')
  async makeViewUrl(@Query('path') objectPath: string) {
    return this.storage.createSignedViewUrl(objectPath);
  }
}
