import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
// Only import admin when needed for Firebase operations

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
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
        // password_hash đang NOT NULL -> đặt '' cho user từ Firebase
        password_hash: '',
      },
    });
  }

  // ========== Local (email/password) ==========
  async localSignup(data: { email: string; password: string; name?: string }) {
    if (!data.email || !data.password)
      throw new BadRequestException('Missing email or password');

    // Check if user already exists
    const existingUser = await this.prisma.users.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const hash = await bcrypt.hash(data.password, 12);
    const displayName = data.name ?? data.email.split('@')[0];

    // Generate a unique firebase_uid for local users to satisfy schema constraint
    // Use a prefix to distinguish from real Firebase UIDs
    const localFirebaseUid = `local_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    const user = await this.prisma.users.create({
      data: {
        email: data.email,
        name: displayName,
        password_hash: hash,
        firebase_uid: localFirebaseUid,
      },
    });

    return { user, token: this.signLocalJwt(user) };
  }

  async localLogin(data: { email: string; password: string }) {
    const user = await this.prisma.users.findUnique({
      where: { email: data.email },
    });
    if (!user || !user.password_hash)
      throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(data.password, user.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return { user, token: this.signLocalJwt(user) };
  }

  private signLocalJwt(user: {
    id: string;
    email: string;
    name: string | null;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      typ: 'local',
    };
    return this.jwt.sign(payload);
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
