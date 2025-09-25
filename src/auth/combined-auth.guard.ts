import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as admin from 'firebase-admin';
import type { UserPayload } from 'src/type/user-payload.type';
import { IS_PUBLIC_KEY } from './public.decorator';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CombinedAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly prisma: PrismaService,
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

      // Find the database user to get the proper database ID
      const dbUser = await this.prisma.users.findUnique({
        where: { firebase_uid: decoded.uid },
        select: { id: true },
      });

      if (!dbUser) {
        throw new UnauthorizedException('User not found in database');
      }

      req.user = {
        source: 'firebase',
        uid: dbUser.id, // Use database ID instead of Firebase UID
        email: decoded.email || '',
        name: typeof decoded.name === 'string' ? decoded.name : undefined,
        picture: decoded.picture || undefined,
      } satisfies UserPayload;
      return true;
    } catch (e) {
      console.error('Firebase auth error:', e);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
