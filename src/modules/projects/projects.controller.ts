import { Body, Controller, Query } from '@nestjs/common';
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
}
