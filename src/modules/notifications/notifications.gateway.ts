/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

/**
 * Interface for Socket data extension
 */
interface SocketData {
  userId: string;
  notificationTypes?: string[];
}

/**
 * Type alias for typed Socket
 */
type TypedSocket = Socket<any, any, any, SocketData>;

/**
 * Interface for JWT payload
 */
interface JwtPayload {
  sub?: string;
  userId?: string;
  [key: string]: any;
}

/**
 * WebSocket Gateway for real-time notifications
 *
 * Use cases:
 * - Client đang mở app → nhận notifications qua WebSocket (real-time)
 * - Client background → nhận qua FCM push
 *
 * Architecture:
 * - Android client connects: wss://backend.com/notifications
 * - Auth via JWT token in handshake
 * - Subscribe to user-specific room: `user_{userId}`
 * - Emit notifications to specific users/rooms
 */
@WebSocketGateway({
  cors: {
    origin: '*', // TODO: Restrict in production
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // Track online users: userId -> Set<socketId>
  private onlineUsers = new Map<string, Set<string>>();

  constructor(private jwtService: JwtService) {}

  /**
   * Handle client connection
   * Auth flow:
   * 1. Client sends JWT token in handshake query
   * 2. Verify token and extract userId
   * 3. Join user to their personal room
   */
  async handleConnection(client: Socket<any, any, any, SocketData>) {
    try {
      const token =
        (client.handshake.auth.token as string) ||
        (client.handshake.query.token as string);

      if (!token) {
        console.log('❌ WebSocket connection rejected: No token');
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const userId = payload.sub || payload.userId;

      if (!userId) {
        console.log('❌ WebSocket connection rejected: Invalid token');
        client.disconnect();
        return;
      }

      // Store userId in socket data
      client.data.userId = userId;

      // Join user to their personal room
      const userRoom = `user_${userId}`;
      await client.join(userRoom);

      // Track online status
      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, new Set());
      }
      this.onlineUsers.get(userId)!.add(client.id);

      console.log(`✅ User ${userId} connected via WebSocket (${client.id})`);
      console.log(
        `   Total connections for user: ${this.onlineUsers.get(userId)!.size}`,
      );

      // Send welcome message
      client.emit('connected', {
        message: 'Connected to notification service',
        userId,
        timestamp: new Date().toISOString(),
      });

      // Notify user they're online (optional)
      this.emitToUser(userId, 'status', { online: true });
    } catch (error: any) {
      console.error('❌ WebSocket auth error:', error?.message || error);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (userId) {
      const userSockets = this.onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(client.id);

        if (userSockets.size === 0) {
          // User completely offline
          this.onlineUsers.delete(userId);
          console.log(`🔴 User ${userId} went offline`);
        } else {
          console.log(
            `⚠️ User ${userId} disconnected one socket, ${userSockets.size} remaining`,
          );
        }
      }
    }

    console.log(`❌ Client disconnected: ${client.id}`);
  }

  /**
   * Subscribe to specific notification types
   * Example: { types: ['TASK_ASSIGNED', 'MEETING_REMINDER'] }
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { types?: string[] },
  ) {
    const userId = client.data.userId;
    console.log(`📬 User ${userId} subscribed to:`, data.types || 'all');

    // Store preferences in socket data
    client.data.notificationTypes = data.types || [];

    return {
      event: 'subscribed',
      data: {
        types: client.data.notificationTypes,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Mark notification as read
   */
  @SubscribeMessage('mark_read')
  handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string },
  ) {
    const userId = client.data.userId;
    console.log(
      `✓ User ${userId} marked notification ${data.notificationId} as read`,
    );

    // TODO: Update notification status in database
    // await this.notificationsService.markAsRead(data.notificationId, userId);

    return {
      event: 'marked_read',
      data: { notificationId: data.notificationId },
    };
  }

  /**
   * Ping/Pong for connection health check
   */
  @SubscribeMessage('ping')
  handlePing() {
    return {
      event: 'pong',
      data: { timestamp: new Date().toISOString() },
    };
  }

  // ============================================
  // Public methods for emitting notifications
  // ============================================

  /**
   * Emit notification to specific user
   * Called from NotificationsService when creating notifications
   */
  emitToUser(userId: string, event: string, data: any) {
    const userRoom = `user_${userId}`;
    this.server.to(userRoom).emit(event, data);
    console.log(`📤 Emitted '${event}' to user ${userId}`);
  }

  /**
   * Emit notification to multiple users
   */
  emitToUsers(userIds: string[], event: string, data: any) {
    userIds.forEach((userId) => {
      this.emitToUser(userId, event, data);
    });
  }

  /**
   * Emit to project/workspace members
   */
  emitToProject(projectId: string, event: string, data: any) {
    const projectRoom = `project_${projectId}`;
    this.server.to(projectRoom).emit(event, data);
    console.log(`📤 Emitted '${event}' to project ${projectId}`);
  }

  /**
   * Check if user is online (has active WebSocket connection)
   */
  isUserOnline(userId: string): boolean {
    const sockets = this.onlineUsers.get(userId);
    return !!sockets && sockets.size > 0;
  }

  /**
   * Get count of online users
   */
  getOnlineUsersCount(): number {
    return this.onlineUsers.size;
  }

  /**
   * Get all online user IDs
   */
  getOnlineUserIds(): string[] {
    return Array.from(this.onlineUsers.keys());
  }
}
