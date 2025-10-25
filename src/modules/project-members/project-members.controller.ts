import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ProjectMembersService } from './project-members.service';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { ConvertToTeamDto } from './dto/convert-to-team.dto';

@Controller('projects/:projectId')
@UseGuards(CombinedAuthGuard)
export class ProjectMembersController {
  constructor(private readonly projectMembersService: ProjectMembersService) {}

  @Post('members/invite')
  async inviteMember(
    @Param('projectId') projectId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.projectMembersService.inviteMember(projectId, userId, dto);
  }

  @Get('members')
  async listMembers(
    @Param('projectId') projectId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.projectMembersService.listMembers(projectId, userId);
  }

  @Patch('members/:memberId')
  async updateMemberRole(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.projectMembersService.updateMemberRole(
      projectId,
      memberId,
      userId,
      dto,
    );
  }

  @Delete('members/:memberId')
  async removeMember(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.projectMembersService.removeMember(projectId, memberId, userId);
  }

  @Post('convert-to-team')
  async convertToTeam(
    @Param('projectId') projectId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: ConvertToTeamDto,
  ) {
    return this.projectMembersService.convertToTeam(projectId, userId, dto);
  }
}
