import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Request } from 'express';
import type { UserPayload } from 'src/type/user-payload.type';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req: Request = ctx.switchToHttp().getRequest();
    const auth = req.headers.authorization || '';
    const [type, token] = auth.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('No token provided');
    }
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = {
        source: 'firebase',
        uid: decodedToken.uid,
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
