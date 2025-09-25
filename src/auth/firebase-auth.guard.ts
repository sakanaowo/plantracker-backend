import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Request } from 'express';
import type { UserPayload } from 'src/type/user-payload.type';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  // TODO: remove firebase auth guard
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req: Request = ctx.switchToHttp().getRequest();
    const auth = req.headers.authorization || '';
    const [type, token] = auth.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('No token provided');
    }
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);

      // Find the database user to get the proper database ID
      const dbUser = await this.prisma.users.findUnique({
        where: { firebase_uid: decodedToken.uid },
        select: { id: true },
      });

      if (!dbUser) {
        throw new UnauthorizedException('User not found in database');
      }

      req.user = {
        source: 'firebase',
        uid: dbUser.id, // Use database ID instead of Firebase UID
        email: decodedToken.email ?? '',
        name:
          typeof decodedToken.name === 'string' ? decodedToken.name : undefined,
        picture: decodedToken.picture ?? '',
      } satisfies UserPayload;
      return true;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      throw new UnauthorizedException(`Invalid token: ${error.message}`);
    }
  }
}
