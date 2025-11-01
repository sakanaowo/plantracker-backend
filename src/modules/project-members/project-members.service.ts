import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { ConvertToTeamDto } from './dto/convert-to-team.dto';
import { project_role } from '@prisma/client';

@Injectable()
export class ProjectMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Invite member to TEAM project
   */
  async inviteMember(
    projectId: string,
    invitedBy: string,
    dto: InviteMemberDto,
  ) {
    // Get project
    const project = await this.prisma.projects.findUnique({
      where: { id: projectId },
      include: {
        workspaces: {
          select: { id: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Auto-convert PERSONAL to TEAM if needed
    if (project.type === 'PERSONAL') {
      // Check if user is workspace owner (required for conversion)
      const workspace = await this.prisma.workspaces.findUnique({
        where: { id: project.workspace_id },
        include: {
          memberships: {
            where: { user_id: invitedBy },
          },
        },
      });

      const membership = workspace?.memberships[0];
      if (!membership || membership.role !== 'OWNER') {
        throw new ForbiddenException(
          'Only workspace owner can invite members to PERSONAL projects. Convert to TEAM project first.',
        );
      }

      // Auto-convert to TEAM
      await this.prisma.projects.update({
        where: { id: projectId },
        data: { type: 'TEAM' },
      });

      // Add workspace owner as project OWNER member
      await this.prisma.project_members.create({
        data: {
          project_id: projectId,
          user_id: invitedBy, // The workspace owner becomes project owner
          role: 'OWNER',
          added_by: invitedBy,
        },
      });

      // Log conversion activity
      await this.activityLogsService.logProjectUpdated({
        projectId,
        userId: invitedBy,
        projectName: project.name,
        oldValue: { type: 'PERSONAL' },
        newValue: { type: 'TEAM' },
      });
    } else {
      // For TEAM projects, check permission (must be OWNER or ADMIN)
      await this.checkProjectRole(projectId, invitedBy, ['OWNER', 'ADMIN']);
    }

    // Find user by email
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException(`User not found with email: ${dto.email}`);
    }

    // Check if already member
    const existing = await this.prisma.project_members.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: user.id,
        },
      },
    });

    if (existing) {
      throw new ConflictException('User is already a project member');
    }

    // Create invitation instead of direct member
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days to accept

    const invitation = await this.prisma.project_invitations.create({
      data: {
        project_id: projectId,
        user_id: user.id,
        role: dto.role ?? 'MEMBER',
        invited_by: invitedBy,
        expires_at: expiresAt,
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar_url: true,
          },
        },
        projects: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Log activity
    await this.activityLogsService.logMemberAdded({
      projectId,
      userId: invitedBy,
      memberId: invitation.id,
      memberName: user.name,
      role: dto.role ?? 'MEMBER',
      metadata: {
        email: user.email,
        type: 'INVITATION_SENT',
      },
    });

    // Send notification to invited user
    const inviter = await this.prisma.users.findUnique({
      where: { id: invitedBy },
      select: { name: true },
    });

    await this.notificationsService.sendProjectInvite({
      projectId,
      projectName: project.name,
      inviteeId: user.id,
      invitedBy,
      invitedByName: inviter?.name ?? 'Hệ thống',
      role: dto.role ?? 'MEMBER',
      invitationId: invitation.id,
    });

    return invitation;
  }

  /**
   * List project members
   */
  async listMembers(projectId: string, userId: string) {
    // Validate project access
    await this.validateProjectAccess(projectId, userId);

    const members = await this.prisma.project_members.findMany({
      where: { project_id: projectId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar_url: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { created_at: 'asc' }],
    });

    return {
      data: members.map((m) => ({
        id: m.id,
        userId: m.user_id,
        role: m.role,
        user: m.users,
        addedBy: m.added_by,
        createdAt: m.created_at,
      })),
      count: members.length,
    };
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    projectId: string,
    memberId: string,
    updatedBy: string,
    dto: UpdateMemberRoleDto,
  ) {
    // Check permission (must be OWNER)
    await this.checkProjectRole(projectId, updatedBy, ['OWNER']);

    // Get member
    const member = await this.prisma.project_members.findUnique({
      where: { id: memberId },
      include: {
        users: true,
      },
    });

    if (!member || member.project_id !== projectId) {
      throw new NotFoundException('Member not found in this project');
    }

    // Prevent removing last owner
    if (member.role === 'OWNER' && dto.role !== 'OWNER') {
      const ownerCount = await this.prisma.project_members.count({
        where: {
          project_id: projectId,
          role: 'OWNER',
        },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Cannot change role of the last project owner',
        );
      }
    }

    // Update role
    const updated = await this.prisma.project_members.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar_url: true,
          },
        },
      },
    });

    // Log activity
    await this.activityLogsService.logMemberRoleUpdated({
      projectId,
      userId: updatedBy,
      memberId,
      memberName: member.users.name,
      oldRole: member.role,
      newRole: dto.role,
    });

    return updated;
  }

  /**
   * Remove member from project
   */
  async removeMember(projectId: string, memberId: string, removedBy: string) {
    // Check permission (OWNER or ADMIN)
    await this.checkProjectRole(projectId, removedBy, ['OWNER', 'ADMIN']);

    // Get member
    const member = await this.prisma.project_members.findUnique({
      where: { id: memberId },
      include: {
        users: true,
      },
    });

    if (!member || member.project_id !== projectId) {
      throw new NotFoundException('Member not found in this project');
    }

    // Prevent removing last owner
    if (member.role === 'OWNER') {
      const ownerCount = await this.prisma.project_members.count({
        where: {
          project_id: projectId,
          role: 'OWNER',
        },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the last project owner');
      }
    }

    // Remove member
    await this.prisma.project_members.delete({
      where: { id: memberId },
    });

    // Log activity
    await this.activityLogsService.logMemberRemoved({
      projectId,
      userId: removedBy,
      memberId,
      memberName: member.users.name,
      role: member.role,
    });

    return { success: true };
  }

  /**
   * Get user's pending invitations
   */
  async getUserInvitations(userId: string) {
    const invitations = await this.prisma.project_invitations.findMany({
      where: {
        user_id: userId,
        status: 'PENDING',
        expires_at: {
          gt: new Date(), // Not expired
        },
      },
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar_url: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return invitations;
  }

  /**
   * Respond to project invitation
   */
  async respondToInvitation(
    invitationId: string,
    userId: string,
    action: 'accept' | 'decline',
  ) {
    // Get invitation
    const invitation = await this.prisma.project_invitations.findUnique({
      where: { id: invitationId },
      include: {
        projects: true,
        users: true,
        inviter: true,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    // Check if invitation belongs to user
    if (invitation.user_id !== userId) {
      throw new ForbiddenException('This invitation is not for you');
    }

    // Check if invitation is still pending
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(
        `Invitation has already been ${invitation.status.toLowerCase()}`,
      );
    }

    // Check if invitation is expired
    if (invitation.expires_at < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    const updatedStatus = action === 'accept' ? 'ACCEPTED' : 'DECLINED';

    // Update invitation status
    const updatedInvitation = await this.prisma.project_invitations.update({
      where: { id: invitationId },
      data: {
        status: updatedStatus,
        updated_at: new Date(),
      },
    });

    // If accepted, add user as project member
    if (action === 'accept') {
      // Check if already a member (safety check)
      const existingMember = await this.prisma.project_members.findUnique({
        where: {
          project_id_user_id: {
            project_id: invitation.project_id,
            user_id: userId,
          },
        },
      });

      if (!existingMember) {
        await this.prisma.project_members.create({
          data: {
            project_id: invitation.project_id,
            user_id: userId,
            role: invitation.role,
            added_by: invitation.invited_by,
          },
        });
      }

      // Log member added
      await this.activityLogsService.logMemberAdded({
        projectId: invitation.project_id,
        userId: invitation.invited_by,
        memberId: userId,
        memberName: invitation.users.name,
        role: invitation.role,
        metadata: {
          type: 'INVITATION_ACCEPTED',
        },
      });
    } else {
      // Log invitation declined
      await this.activityLogsService.logMemberRemoved({
        projectId: invitation.project_id,
        userId: invitation.invited_by,
        memberId: userId,
        memberName: invitation.users.name,
        role: invitation.role,
      });
    }

    return {
      invitation: updatedInvitation,
      action,
      message: `Invitation ${action}ed successfully`,
    };
  }

  /**
   * Convert PERSONAL project to TEAM project
   */
  async convertToTeam(
    projectId: string,
    userId: string,
    dto: ConvertToTeamDto,
  ) {
    // Get project
    const project = await this.prisma.projects.findUnique({
      where: { id: projectId },
      include: {
        workspaces: {
          include: {
            memberships: true,
          },
        },
        project_members: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check permission (must be workspace OWNER)
    const membership = project.workspaces.memberships.find(
      (m) => m.user_id === userId,
    );

    if (!membership || membership.role !== 'OWNER') {
      throw new ForbiddenException(
        'Only workspace owner can convert project to TEAM',
      );
    }

    // Check if already TEAM
    if (project.type === 'TEAM') {
      throw new BadRequestException('Project is already a TEAM project');
    }

    // Update project type
    const updated = await this.prisma.projects.update({
      where: { id: projectId },
      data: { type: 'TEAM' },
    });

    // Log activity
    await this.activityLogsService.logProjectUpdated({
      projectId,
      userId,
      projectName: project.name,
      oldValue: { type: 'PERSONAL' },
      newValue: { type: 'TEAM' },
    });

    return {
      ...updated,
      memberCount: project.project_members.length,
      convertedAt: new Date(),
    };
  }

  /**
   * Helper: Check if user has required role in project
   */
  private async checkProjectRole(
    projectId: string,
    userId: string,
    requiredRoles: project_role[],
  ) {
    const member = await this.prisma.project_members.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this project');
    }

    if (!requiredRoles.includes(member.role)) {
      throw new ForbiddenException(
        `This action requires one of these roles: ${requiredRoles.join(', ')}`,
      );
    }

    return member;
  }

  /**
   * Helper: Validate user has access to project
   */
  private async validateProjectAccess(projectId: string, userId: string) {
    const project = await this.prisma.projects.findUnique({
      where: { id: projectId },
      include: {
        workspaces: {
          include: {
            memberships: {
              where: { user_id: userId },
            },
          },
        },
        project_members: {
          where: { user_id: userId },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // For PERSONAL projects: check workspace membership
    if (project.type === 'PERSONAL') {
      if (project.workspaces.memberships.length === 0) {
        throw new ForbiddenException('Access denied to this project');
      }
    }
    // For TEAM projects: check project membership
    else {
      if (project.project_members.length === 0) {
        throw new ForbiddenException('Access denied to this project');
      }
    }

    return project;
  }
}
