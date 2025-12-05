import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WorkspacesService } from 'src/modules/workspaces/workspaces.service';
import {
  RegisterDeviceDto,
  UpdateTokenDto,
  DeviceResponseDto,
} from 'src/modules/notifications/dto';
import * as admin from 'firebase-admin';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
  ) {}

  // ========== Firebase ==========
  async ensureFromFirebase(opts: {
    uid: string;
    email?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
  }) {
    const { uid, email, name, avatarUrl } = opts;
    if (!email) throw new BadRequestException('Firebase user has no email');

    console.log('[ensureFromFirebase] Starting for:', { uid, email });

    try {
      // Try to find by id (which is Firebase UID now)
      let user = await this.prisma.users.findUnique({
        where: { id: uid },
      });

      console.log('[ensureFromFirebase] Found by id:', !!user);

      if (user) {
        // User exists, just update
        console.log('[ensureFromFirebase] Updating existing user');
        user = await this.prisma.users.update({
          where: { id: user.id },
          data: {
            email,
            name: name ?? undefined,
            avatar_url: avatarUrl ?? undefined,
            updated_at: new Date(),
          },
        });
      } else {
        // New user, create with Firebase UID as id
        console.log('[ensureFromFirebase] Creating new user');
        user = await this.prisma.users.create({
          data: {
            id: uid,
            email,
            name: name ?? email.split('@')[0],
            avatar_url: avatarUrl ?? null,
            password_hash: '',
          },
        });
      }

      // Ensure personal workspace exists for any Firebase user sync
      await this.workspaces.ensurePersonalWorkspaceByUserId(user.id, user.name);

      return user;
    } catch (error) {
      console.error('[ensureFromFirebase] Error occurred:', error);
      // Handle race condition: if user was created between our check and create
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          console.log(
            '[ensureFromFirebase] P2002 detected - race condition, retrying...',
          );
          // Unique constraint violation - try to find the user again
          const user = await this.prisma.users.findUnique({
            where: { id: uid },
          });
          if (user) {
            console.log('[ensureFromFirebase] Found user after retry');
            await this.workspaces.ensurePersonalWorkspaceByUserId(user.id);
            return user;
          }
        }
      }
      throw error;
    }
  }

  // ========== email/password ==========
  async localSignup(data: { email: string; password: string; name?: string }) {
    if (!data.email || !data.password)
      throw new BadRequestException('Missing email or password');

    const displayName = data.name ?? data.email.split('@')[0];
    try {
      const firebaseUser = await admin.auth().createUser({
        email: data.email,
        password: data.password,
        displayName,
      });

      const tokens = await this.signInWithFirebase(data.email, data.password);
      const user = await this.ensureFromFirebase({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName,
        avatarUrl: firebaseUser.photoURL,
      });

      return {
        user,
        token: tokens.idToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (error) {
      if (error && typeof error === 'object') {
        const firebaseError = error as { code?: string; message?: string };
        if (firebaseError.code === 'auth/email-already-exists') {
          throw new BadRequestException('User with this email already exists');
        }
      }
      throw error;
    }
  }

  async localLogin(data: { email: string; password: string }) {
    if (!data.email || !data.password) {
      throw new BadRequestException('Missing email or password');
    }
    try {
      const tokens = await this.signInWithFirebase(data.email, data.password);

      const decoded = await admin.auth().verifyIdToken(tokens.idToken);
      const firebaseUser = await admin.auth().getUser(decoded.uid);

      const user = await this.ensureFromFirebase({
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? decoded.email ?? data.email,
        name:
          firebaseUser.displayName ??
          (typeof decoded.name === 'string' ? decoded.name : null) ??
          data.email.split('@')[0] ??
          null,
        avatarUrl: firebaseUser.photoURL ?? decoded.picture ?? null,
      });
      return {
        user,
        token: tokens.idToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (error) {
      const firebaseError =
        typeof error === 'object' && error !== null
          ? (error as { code?: string; error?: { message?: string } })
          : undefined;
      const code = firebaseError?.code ?? firebaseError?.error?.message ?? '';

      switch (code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'EMAIL_NOT_FOUND':
        case 'INVALID_PASSWORD':
          throw new UnauthorizedException({
            statusCode: 401,
            message: 'Invalid email or password',
            error: 'INVALID_CREDENTIALS',
          });
        case 'auth/too-many-requests':
        case 'TOO_MANY_ATTEMPTS_TRY_LATER':
          throw new UnauthorizedException({
            statusCode: 429,
            message:
              'Too many unsuccessful login attempts. Please try again later.',
            error: 'TOO_MANY_ATTEMPTS',
          });
        default:
          throw error;
      }
    }
  }

  private async signInWithFirebase(email: string, password: string) {
    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!apiKey) {
      throw new Error('FIREBASE_WEB_API_KEY is not configured');
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      },
    );

    const payload = (await response.json()) as
      | {
          idToken?: string;
          refreshToken?: string;
          expiresIn?: string;
          localId?: string;
          error?: { message?: string };
        }
      | undefined;

    if (!response.ok || !payload?.idToken || !payload.refreshToken) {
      const message = payload?.error?.message ?? 'Firebase sign-in failed';
      throw new BadRequestException(message);
    }

    return {
      idToken: payload.idToken,
      refreshToken: payload.refreshToken,
      expiresIn: payload.expiresIn,
      localId: payload.localId,
    };
  }

  async firebaseAuth(firebaseUid: string, idToken: string) {
    // Get current Firebase user data
    const firebaseUser = await admin.auth().getUser(firebaseUid);

    // Ensure user exists in database (should already exist due to CombinedAuthGuard)
    const user = await this.ensureFromFirebase({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: firebaseUser.displayName,
      avatarUrl: firebaseUser.photoURL,
    });

    // Return same format as localSignup/localLogin for consistency
    return {
      user,
      token: idToken, // Client already has this token
      authMethod: 'firebase',
      message: 'Firebase authentication successful',
    };
  }

  getById(id: string) {
    return this.prisma.users.findUnique({ where: { id } });
  }

  async updateMeById(
    id: string,
    data: {
      name?: string;
      avatar_url?: string;
      bio?: string;
      job_title?: string;
      phone_number?: string;
    },
  ) {
    console.log('🔄 updateMeById called with:', { id, data });

    // Update user profile
    const updatedUser = await this.prisma.users.update({
      where: { id },
      data: {
        name: data.name ?? undefined,
        avatar_url: data.avatar_url ?? undefined,
        bio: data.bio ?? undefined,
        job_title: data.job_title ?? undefined,
        phone_number: data.phone_number ?? undefined,
        updated_at: new Date(),
      },
    });

    console.log('✅ User updated:', updatedUser.name);

    // If name is updated, also update the personal workspace name
    if (data.name) {
      console.log('🔍 Searching for personal workspace for user:', id);

      try {
        const personalWorkspace = await this.prisma.workspaces.findFirst({
          where: {
            owner_id: id,
          },
        });

        console.log('📂 Found workspace:', personalWorkspace?.name);

        if (personalWorkspace) {
          const newWorkspaceName = `${data.name.trim()}'s Workspace`;

          await this.prisma.workspaces.update({
            where: { id: personalWorkspace.id },
            data: {
              name: newWorkspaceName,
              updated_at: new Date(),
            },
          });

          console.log(
            `✅ Updated personal workspace name to: ${newWorkspaceName}`,
          );
        } else {
          console.log('⚠️ No personal workspace found for user:', id);
        }
      } catch (error) {
        // Log error but don't fail the user update
        console.error('❌ Failed to update personal workspace name:', error);
      }
    } else {
      console.log('ℹ️ Name not provided, skipping workspace update');
    }

    return updatedUser;
  }

  // ==================== FCM DEVICE MANAGEMENT ====================

  /**
   * Register or update FCM device token
   */
  async registerDevice(
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<DeviceResponseDto> {
    console.log(`🔔 [FCM] Registering device for user: ${userId}`);
    console.log(`   FCM Token: ${dto.fcmToken.substring(0, 20)}...`);
    console.log(`   Platform: ${dto.platform}, Model: ${dto.deviceModel}`);

    // Check if device already exists by fcm_token
    const existingDevice = await this.prisma.user_devices.findUnique({
      where: { fcm_token: dto.fcmToken },
    });

    if (existingDevice) {
      console.log(
        `✅ [FCM] Token already registered, updating device ${existingDevice.id}`,
      );
      // Update existing device
      const updated = await this.prisma.user_devices.update({
        where: { id: existingDevice.id },
        data: {
          user_id: userId, // Re-assign to current user if changed
          platform: dto.platform,
          device_model: dto.deviceModel ?? null,
          app_version: dto.appVersion ?? null,
          locale: dto.locale ?? null,
          timezone: dto.timezone ?? null,
          is_active: true,
          last_active_at: new Date(),
        },
      });
      console.log(`✓ Device updated successfully`);
      return this.mapDeviceToDto(updated);
    }

    console.log(`🆕 [FCM] Creating new device registration`);
    // Create new device
    const device = await this.prisma.user_devices.create({
      data: {
        user_id: userId,
        fcm_token: dto.fcmToken,
        platform: dto.platform,
        device_model: dto.deviceModel ?? null,
        app_version: dto.appVersion ?? null,
        locale: dto.locale ?? null,
        timezone: dto.timezone ?? null,
        is_active: true,
        last_active_at: new Date(),
      },
    });

    console.log(`✅ [FCM] Device registered with ID: ${device.id}`);
    return this.mapDeviceToDto(device);
  }

  /**
   * Update FCM token for existing device
   */
  async updateFcmToken(
    userId: string,
    dto: UpdateTokenDto,
  ): Promise<DeviceResponseDto> {
    // Find device by ID and verify ownership
    const device = await this.prisma.user_devices.findFirst({
      where: {
        id: dto.deviceId,
        user_id: userId,
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Update to new token
    const updated = await this.prisma.user_devices.update({
      where: { id: device.id },
      data: {
        fcm_token: dto.newFcmToken,
        last_active_at: new Date(),
      },
    });

    return this.mapDeviceToDto(updated);
  }

  /**
   * Unregister device (soft delete by setting is_active = false)
   */
  async unregisterDevice(
    userId: string,
    deviceId: string,
  ): Promise<{ message: string }> {
    const device = await this.prisma.user_devices.findFirst({
      where: {
        id: deviceId,
        user_id: userId,
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    await this.prisma.user_devices.update({
      where: { id: deviceId },
      data: {
        is_active: false,
        last_active_at: new Date(),
      },
    });

    return { message: 'Device unregistered successfully' };
  }

  /**
   * Get all active devices for user
   */
  async getUserDevices(userId: string): Promise<DeviceResponseDto[]> {
    const devices = await this.prisma.user_devices.findMany({
      where: {
        user_id: userId,
        is_active: true,
      },
      orderBy: {
        last_active_at: 'desc',
      },
    });

    return devices.map((d) => this.mapDeviceToDto(d));
  }

  /**
   * Helper: Map Prisma model to DTO
   */
  private mapDeviceToDto(device: {
    id: string;
    user_id: string;
    fcm_token: string;
    platform: string;
    device_model: string | null;
    app_version: string | null;
    locale: string | null;
    timezone: string | null;
    is_active: boolean;
    last_active_at: Date | null;
  }): DeviceResponseDto {
    return {
      id: device.id,
      userId: device.user_id,
      fcmToken: device.fcm_token,
      platform: device.platform,
      deviceModel: device.device_model ?? undefined,
      appVersion: device.app_version ?? undefined,
      locale: device.locale ?? undefined,
      timezone: device.timezone ?? undefined,
      isActive: device.is_active,
      lastActiveAt: device.last_active_at ?? undefined,
    };
  }

  /**
   * Delete user account permanently
   * This will cascade delete all related data
   */
  async deleteAccount(userId: string) {
    console.log(`🗑️ Deleting user account: ${userId}`);

    try {
      // 1. Delete from Firebase Authentication FIRST
      // This prevents orphan DB records if Firebase deletion fails
      try {
        await admin.auth().deleteUser(userId);
        console.log(`✅ Successfully deleted Firebase user: ${userId}`);
      } catch (firebaseError: any) {
        // If Firebase user doesn't exist, that's okay - continue with DB deletion
        if (firebaseError?.code === 'auth/user-not-found') {
          console.log(
            `ℹ️ Firebase user ${userId} not found, proceeding with DB deletion`,
          );
        } else {
          // Other Firebase errors should fail the operation
          console.error(
            `❌ Failed to delete Firebase user ${userId}:`,
            firebaseError,
          );
          throw new BadRequestException('Failed to delete Firebase account');
        }
      }

      // 2. Delete from database (cascade will handle related data)
      await this.prisma.users.delete({
        where: { id: userId },
      });

      console.log(`✅ Successfully deleted user from database: ${userId}`);
      return { message: 'Account deleted successfully' };
    } catch (error) {
      console.error(`❌ Error deleting user ${userId}:`, error);
      throw new BadRequestException('Failed to delete account');
    }
  }
}
