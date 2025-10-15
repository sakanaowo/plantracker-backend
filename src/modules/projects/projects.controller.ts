import {
  Body,
  Controller,
  Post,
  Query,
  Get,
  Patch,
  Param,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}
  @Get()
  list(@Query('workspaceId') workspaceId: string) {
    return this.svc.listByWorkSpace(workspaceId);
  }

  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.svc.update(id, dto);
  }
}
