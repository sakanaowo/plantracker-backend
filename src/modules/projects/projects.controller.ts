import {
  Body,
  Controller,
  Post,
  Query,
  Get,
  Patch,
  Delete,
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
  list(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser('id') userId: string,
  ) {
    // If workspaceId is provided, filter by workspace
    // If not, return all projects the user has access to
    if (workspaceId) {
      return this.svc.listByWorkSpace(workspaceId, userId);
    }
    return this.svc.listAllUserProjects(userId);
  }

  @Get(':id')
  getById(@Param('id') projectId: string, @CurrentUser('id') userId: string) {
    return this.svc.getProjectById(projectId, userId);
  }

  @Get(':id/members')
  getMembers(@Param('id') projectId: string) {
    return this.svc.getMembers(projectId);
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

  @Get(':id/summary')
  getSummary(
    @Param('id') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.getProjectSummary(projectId, userId);
  }

  @Delete(':id')
  delete(@Param('id') projectId: string, @CurrentUser('id') userId: string) {
    return this.svc.deleteProject(projectId, userId);
  }

  @Post(':id/leave')
  leave(@Param('id') projectId: string, @CurrentUser('id') userId: string) {
    return this.svc.leaveProject(projectId, userId);
  }
}
