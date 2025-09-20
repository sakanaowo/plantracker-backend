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

@Controller('projects')
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}
  @Get()
  list(@Query('workspaceId') workspaceId: string) {
    return this.svc.listByWorkSpace(workspaceId);
  }

  @Post()
  create(
    @Body()
    body: {
      name: string;
      workspace_id: string;
      key?: string;
      description?: string;
    },
  ) {
    return this.svc.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; key?: string; description?: string },
  ) {
    return this.svc.update(id, body);
  }
}
