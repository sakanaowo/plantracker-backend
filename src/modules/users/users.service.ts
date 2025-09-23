import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WorkspacesService } from 'src/modules/workspaces/workspaces.service';
import * as admin from 'firebase-admin';

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

    return this.prisma.users.upsert({
      where: { firebase_uid: uid },
      update: {
        email,
        name: name ?? undefined,
        avatar_url: avatarUrl ?? undefined,
        updated_at: new Date(),
      },
      create: {
        firebase_uid: uid,
        email,
        name: name ?? email.split('@')[0],
        avatar_url: avatarUrl ?? null,
        password_hash: '',
      },
    });
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

      await this.workspaces.ensurePersonalWorkspaceByUserId(user.id);

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
          throw new UnauthorizedException('Invalid email or password');
        case 'auth/too-many-requests':
        case 'TOO_MANY_ATTEMPTS_TRY_LATER':
          throw new UnauthorizedException(
            'Too many failed login attempts. Please try again later.',
          );
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

  // ========== Common ==========
  getByFirebaseUid(uid: string) {
    return this.prisma.users.findUnique({ where: { firebase_uid: uid } });
  }

  getById(id: string) {
    return this.prisma.users.findUnique({ where: { id } });
  }

  updateMeByFirebase(
    uid: string,
    data: { name?: string; email?: string; avatar_url?: string },
  ) {
    return this.prisma.users.update({
      where: { firebase_uid: uid },
      data: {
        name: data.name ?? undefined,
        email: data.email ?? undefined,
        avatar_url: data.avatar_url ?? undefined,
        updated_at: new Date(),
      },
    });
  }

  updateMeById(
    id: string,
    data: { name?: string; email?: string; avatar_url?: string },
  ) {
    return this.prisma.users.update({
      where: { id },
      data: {
        name: data.name ?? undefined,
        email: data.email ?? undefined,
        avatar_url: data.avatar_url ?? undefined,
        updated_at: new Date(),
      },
    });
  }
}
