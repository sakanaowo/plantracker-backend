import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as admin from 'firebase-admin';
// import type { UserPayload } from 'src/type/user-payload.type';
import { IS_PUBLIC_KEY } from './public.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/modules/users/users.service';

@Injectable()
export class CombinedAuthGuard implements CanActivate {
  private readonly logger = new Logger(CombinedAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const req: Request = ctx.switchToHttp().getRequest();
    const auth = req.headers.authorization || '';
    const [type, token] = auth.split(' ');
    if (type !== 'Bearer' || !token)
      throw new UnauthorizedException('No token provided');

    try {
      const decoded = await admin.auth().verifyIdToken(token);

      // Find or auto-sync the database user
      let dbUser = await this.prisma.users.findUnique({
        where: { id: decoded.uid }, // ✅ Changed from firebase_uid to id
        select: { id: true },
      });

      if (!dbUser) {
        this.logger.log(`Auto-syncing user from Firebase: ${decoded.uid}`);

        // Auto-sync: Get full Firebase user data
        const firebaseUser = await admin.auth().getUser(decoded.uid);

        // Create user in database (workspace will be auto-created)
        const syncedUser = await this.usersService.ensureFromFirebase({
          uid: firebaseUser.uid,
          email: firebaseUser.email || decoded.email || '',
          name:
            firebaseUser.displayName ||
            (typeof decoded.name === 'string' ? decoded.name : null) ||
            (firebaseUser.email || decoded.email || '').split('@')[0],
          avatarUrl: firebaseUser.photoURL || decoded.picture || null,
        });

        dbUser = { id: syncedUser.id };

        this.logger.log(`Successfully auto-synced user: ${syncedUser.id}`);
      }

      // req.user = {
      //   source: 'firebase',
      //   uid: dbUser.id, // Use database ID instead of Firebase UID
      //   email: decoded.email || '',
      //   name: typeof decoded.name === 'string' ? decoded.name : undefined,
      //   picture: decoded.picture || undefined,
      // } satisfies UserPayload;
      req.user = dbUser.id;
      return true;
    } catch (e) {
      this.logger.error('Firebase auth error:', e);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
