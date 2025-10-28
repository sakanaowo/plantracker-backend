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
      // First, try to find by firebase_uid
      let user = await this.prisma.users.findUnique({
        where: { firebase_uid: uid },
      });

      console.log('[ensureFromFirebase] Found by firebase_uid:', !!user);

      console.log('[ensureFromFirebase] Found by firebase_uid:', !!user);

      if (user) {
        // User exists with this firebase_uid, just update
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
        // Check if a user with this email already exists (from migration)
        console.log('[ensureFromFirebase] Checking by email:', email);
        const existingUserByEmail = await this.prisma.users.findUnique({
          where: { email },
        });

        console.log(
          '[ensureFromFirebase] Found by email:',
          !!existingUserByEmail,
        );

        if (existingUserByEmail) {
          // User exists with this email but different firebase_uid
          // This happens after migration - update firebase_uid
          console.log(
            '[ensureFromFirebase] Updating firebase_uid for existing user',
          );
          user = await this.prisma.users.update({
            where: { id: existingUserByEmail.id },
            data: {
              firebase_uid: uid,
              name: name ?? undefined,
              avatar_url: avatarUrl ?? undefined,
              updated_at: new Date(),
            },
          });
        } else {
          // New user, create
          console.log('[ensureFromFirebase] Creating new user');
          user = await this.prisma.users.create({
            data: {
              firebase_uid: uid,
              email,
              name: name ?? email.split('@')[0],
              avatar_url: avatarUrl ?? null,
              password_hash: '',
            },
          });
        }
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
            where: { firebase_uid: uid },
          });
          if (user) {
            console.log('[ensureFromFirebase] Found user after retry by uid');
            await this.workspaces.ensurePersonalWorkspaceByUserId(user.id);
            return user;
          }
          // If still not found by firebase_uid, try by email
          const userByEmail = await this.prisma.users.findUnique({
            where: { email },
          });
          if (userByEmail) {
            console.log('[ensureFromFirebase] Found user after retry by email');
            // Update firebase_uid for this user
            const updatedUser = await this.prisma.users.update({
              where: { id: userByEmail.id },
              data: { firebase_uid: uid },
            });
            await this.workspaces.ensurePersonalWorkspaceByUserId(
              updatedUser.id,
            );
            return updatedUser;
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

  updateMeById(id: string, data: { name?: string; avatar_url?: string }) {
    return this.prisma.users.update({
      where: { id },
      data: {
        name: data.name ?? undefined,
        avatar_url: data.avatar_url ?? undefined,
        updated_at: new Date(),
      },
    });
  }

  // ==================== FCM DEVICE MANAGEMENT ====================

  /**
   * Register or update FCM device token
   */
  async registerDevice(
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<DeviceResponseDto> {
    // Check if device already exists by fcm_token
    const existingDevice = await this.prisma.user_devices.findUnique({
      where: { fcm_token: dto.fcmToken },
    });

    if (existingDevice) {
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
      return this.mapDeviceToDto(updated);
    }

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
}
