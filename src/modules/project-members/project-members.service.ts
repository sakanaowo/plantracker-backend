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
    console.log('=== INVITE MEMBER START ===');
    console.log('Project ID:', projectId);
    console.log('Invited by:', invitedBy);
    console.log('DTO:', dto);

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

    console.log('Project found:', {
      id: project.id,
      name: project.name,
      type: project.type,
    });

    // Auto-convert PERSONAL to TEAM if needed
    if (project.type === 'PERSONAL') {
      console.log('⚠️ Project is PERSONAL, attempting auto-convert to TEAM...');
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
      console.log('✅ Project converted to TEAM');

      // Add/Update workspace owner as project OWNER member (use upsert to avoid duplicate)
      console.log('🔧 DEBUG: Upserting project_member with data:', {
        project_id: projectId,
        user_id: invitedBy,
        user_id_type: typeof invitedBy,
        user_id_length: invitedBy?.length,
        role: 'OWNER',
        added_by: invitedBy,
      });

      try {
        await this.prisma.project_members.upsert({
          where: {
            project_id_user_id: {
              project_id: projectId,
              user_id: invitedBy,
            },
          },
          update: {
            role: 'OWNER', // Ensure role is OWNER
          },
          create: {
            project_id: projectId,
            user_id: invitedBy, // The workspace owner becomes project owner
            role: 'OWNER',
            added_by: invitedBy,
          },
        });
        console.log('✅ Workspace owner added/updated as project OWNER');
      } catch (error) {
        console.error('❌ Failed to upsert project_member:', error);
        throw error;
      }

      // Log conversion activity
      await this.activityLogsService.logProjectUpdated({
        projectId,
        userId: invitedBy,
        projectName: project.name,
        oldValue: { type: 'PERSONAL' },
        newValue: { type: 'TEAM' },
      });
      console.log('✅ Activity log created for conversion');
    } else {
      console.log('ℹ️ Project is already TEAM type');
      // For TEAM projects, check permission (must be OWNER or ADMIN)
      await this.checkProjectRole(projectId, invitedBy, ['OWNER', 'ADMIN']);
    }

    // Find user by email
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      console.log('❌ User not found with email:', dto.email);
      throw new NotFoundException(`User not found with email: ${dto.email}`);
    }

    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      name: user.name,
    });

    // Check if already member
    const existingMember = await this.prisma.project_members.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: user.id,
        },
      },
    });

    if (existingMember) {
      throw new ConflictException('User is already a project member');
    }

    // Check if already has pending invitation
    const existingInvitation = await this.prisma.project_invitations.findUnique(
      {
        where: {
          project_id_user_id: {
            project_id: projectId,
            user_id: user.id,
          },
        },
      },
    );

    if (existingInvitation) {
      if (
        existingInvitation.status === 'PENDING' &&
        existingInvitation.expires_at > new Date()
      ) {
        throw new ConflictException('User already has a pending invitation');
      }
      // If invitation expired or was declined, delete it and create new one
      await this.prisma.project_invitations.delete({
        where: { id: existingInvitation.id },
      });
    }

    // Create invitation instead of direct member
    // Set far future expiration (effectively never expires)
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

    // ✅ Don't create activity log when sending invitation
    // Invitations will be shown in separate Invitations tab via /api/invitations/my endpoint
    // Activity log will be created only when invitation is ACCEPTED (see respondToInvitation method)
    console.log('✅ Invitation created (will appear in invitations tab)');

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
    console.log(
      `📋 listMembers called - projectId: ${projectId}, userId: ${userId}`,
    );

    // Validate project access
    await this.validateProjectAccess(projectId, userId);
    console.log(
      `✅ Access validated for user ${userId} to project ${projectId}`,
    );

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

    console.log(
      `👥 Found ${members.length} members for project ${projectId}:`,
      members.map((m) => `${m.users.name} (${m.role})`).join(', '),
    );

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
        // Skip expiration check - invitations never expire
        // expires_at: {
        //   gt: new Date(), // Not expired
        // },
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

    // Skip expiration check (invitations never expire for now)
    // if (invitation.expires_at < new Date()) {
    //   throw new BadRequestException('Invitation has expired');
    // }

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
        console.log('✅ Added user to project_members');
      }

      // AUTO-ADD: Add user to workspace memberships if not already a member
      const workspaceId = invitation.projects.workspace_id;
      const existingWorkspaceMembership =
        await this.prisma.memberships.findUnique({
          where: {
            user_id_workspace_id: {
              user_id: userId,
              workspace_id: workspaceId,
            },
          },
        });

      if (!existingWorkspaceMembership) {
        await this.prisma.memberships.create({
          data: {
            user_id: userId,
            workspace_id: workspaceId,
            role: 'MEMBER', // Default workspace member role
          },
        });
        console.log(
          `✅ Auto-added user to workspace memberships (workspace: ${workspaceId})`,
        );
      } else {
        console.log(
          `ℹ️ User already in workspace memberships (role: ${existingWorkspaceMembership.role})`,
        );
      }

      // Log member added when accepted (separate from invitation sent)
      await this.activityLogsService.logMemberAdded({
        workspaceId: invitation.projects.workspace_id,
        projectId: invitation.project_id,
        userId: userId, // The user who accepted (not inviter)
        memberId: userId,
        memberName: invitation.users.name,
        role: invitation.role,
        projectName: invitation.projects.name,
        metadata: {
          type: 'INVITATION_ACCEPTED',
          invitedBy: invitation.invited_by,
          invitationId: invitationId,
        },
      });
      console.log('✅ Activity log created for acceptance');

      // ✅ FIX: Send notification to inviter when invitation is accepted
      try {
        await this.notificationsService.sendNotificationToUser(
          invitation.invited_by, // userId (inviter)
          {
            type: 'PROJECT_INVITE_ACCEPTED',
            title: 'Lời mời được chấp nhận',
            body: `${invitation.users.name} đã chấp nhận lời mời tham gia project "${invitation.projects.name}"`,
            data: {
              projectId: invitation.project_id,
              invitationId: invitationId,
              acceptedBy: userId,
              acceptedByName: invitation.users.name,
              role: invitation.role,
            },
            priority: 'HIGH',
          },
        );
        console.log('✅ Notification sent to inviter about acceptance');
      } catch (error) {
        console.error('❌ Failed to send acceptance notification:', error);
      }
    } else {
      // Log invitation declined
      await this.activityLogsService.logMemberRemoved({
        projectId: invitation.project_id,
        userId: invitation.invited_by,
        memberId: userId,
        memberName: invitation.users.name,
        role: invitation.role,
      });

      // ✅ FIX: Send notification to inviter when invitation is declined
      try {
        await this.notificationsService.sendNotificationToUser(
          invitation.invited_by, // userId (inviter)
          {
            type: 'PROJECT_INVITE_DECLINED',
            title: 'Lời mời bị từ chối',
            body: `${invitation.users.name} đã từ chối lời mời tham gia project "${invitation.projects.name}"`,
            data: {
              projectId: invitation.project_id,
              invitationId: invitationId,
              declinedBy: userId,
              declinedByName: invitation.users.name,
              role: invitation.role,
            },
            priority: 'HIGH',
          },
        );
        console.log('✅ Notification sent to inviter about decline');
      } catch (error) {
        console.error('❌ Failed to send decline notification:', error);
      }
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
  async convertToTeam(projectId: string, userId: string) {
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
    let member = await this.prisma.project_members.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: userId,
        },
      },
    });

    if (!member) {
      // 🔧 AUTO-FIX: Check if user is workspace owner (missing project_member record)
      // This handles legacy projects created before we added automatic project_member creation
      const project = await this.prisma.projects.findUnique({
        where: { id: projectId },
        include: {
          workspaces: {
            select: { owner_id: true },
          },
        },
      });

      if (project?.workspaces?.owner_id === userId) {
        console.log(
          '🔧 AUTO-FIX: Workspace owner missing project_member record, creating with OWNER role',
        );
        member = await this.prisma.project_members.create({
          data: {
            project_id: projectId,
            user_id: userId,
            role: 'OWNER',
            added_by: userId,
          },
        });
        console.log(
          '✅ Project_member record auto-created for workspace owner',
        );
      } else {
        throw new ForbiddenException('You are not a member of this project');
      }
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
   *
   * Logic:
   * - User must be in project_members to access ANY project (PERSONAL or TEAM)
   * - Workspace memberships are for workspace-level access, not project-level
   * - Project owner always has access (checked separately if needed)
   */
  private async validateProjectAccess(projectId: string, userId: string) {
    const project = await this.prisma.projects.findUnique({
      where: { id: projectId },
      include: {
        workspaces: true,
        project_members: {
          where: { user_id: userId },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check if user is project member OR workspace owner
    const isProjectMember = project.project_members.length > 0;
    const isWorkspaceOwner = project.workspaces.owner_id === userId;

    if (!isProjectMember && !isWorkspaceOwner) {
      throw new ForbiddenException('Access denied to this project');
    }

    return project;
  }
}
