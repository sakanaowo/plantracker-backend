import {
  Body,
  Controller,
  Post,
  Query,
  Get,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';

@Controller('projects')
@UseGuards(CombinedAuthGuard)
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}
  @Get()
  list(@Query('workspaceId') workspaceId: string) {
    return this.svc.listByWorkSpace(workspaceId);
  }

  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser('id') userId: string) {
    return this.svc.create(dto, userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.update(id, dto, userId);
  }
}
