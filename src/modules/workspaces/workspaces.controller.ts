import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { CombinedAuthGuard } from 'src/auth/combined-auth.guard';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly service: WorkspacesService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateWorkspaceDto) {
    return this.service.createWorkspace(userId, dto);
  }

  @Get()
  listMine(@CurrentUser('id') userId: string) {
    return this.service.listMine(userId);
  }

  @Get(':id')
  getById(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.getById(id, userId);
  }

  @Patch(':id')
  updateWorkspace(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.service.updateWorkspace(id, userId, dto);
  }

  @Delete(':id')
  removeWorkspace(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.removeWorkspace(id, userId);
  }

  @Get(':id/members')
  listMembers(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.listMembers(id, userId);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.service.addMember(id, userId, dto);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser('id') actorId: string,
    @Param('id') workspaceId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.service.removeMember(workspaceId, actorId, targetUserId);
  }
}
