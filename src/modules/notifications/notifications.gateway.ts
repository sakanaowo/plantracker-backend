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
import * as admin from 'firebase-admin';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Interface for Socket data extension
 */
interface SocketData {
  userId: string;
  notificationTypes?: string[];
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
    origin: '*',
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

  constructor(private prisma: PrismaService) {}

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
        console.log('WebSocket connection rejected: No token');
        client.disconnect();
        return;
      }

      // Verify Firebase ID token
      let userId: string;
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        userId = decodedToken.uid;
      } catch (firebaseError) {
        console.error('Firebase token verification failed:', firebaseError);
        client.disconnect();
        return;
      }

      if (!userId) {
        console.log('WebSocket connection rejected: Invalid token');
        client.disconnect();
        return;
      }

      // Store userId in socket data
      client.data.userId = userId;

      // Join user to their personal room
      const userRoom = `user_${userId}`;
      await client.join(userRoom);

      // Auto-join user to all project rooms they're a member of
      await this.joinUserProjectRooms(client, userId);

      // Track online status
      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, new Set());
        console.log(`[WebSocket] First connection for user ${userId}`);
      }
      this.onlineUsers.get(userId)!.add(client.id);

      console.log(
        `[WebSocket] User ${userId} connected (socket: ${client.id})`,
      );
      console.log(
        `   Total connections for this user: ${this.onlineUsers.get(userId)!.size}`,
      );
      console.log(`   Total online users: ${this.onlineUsers.size}`);

      // Send welcome message
      client.emit('connected', {
        message: 'Connected to notification service',
        userId,
        timestamp: new Date().toISOString(),
      });

      // Notify user they're online
      this.emitToUser(userId, 'status', { online: true });
    } catch (error: any) {
      console.error('WebSocket auth error:', error?.message || error);
      client.disconnect();
    }
  }

  /**
   * Auto-join user to all project rooms they're a member of
   * This ensures they receive project-level events (task_updated, event_updated, etc.)
   */
  private async joinUserProjectRooms(client: Socket, userId: string) {
    try {
      // Fetch all projects where user is a member
      const projectMembers = await this.prisma.project_members.findMany({
        where: {
          user_id: userId,
        },
        select: {
          project_id: true,
        },
      });

      const projectIds = projectMembers.map((pm) => pm.project_id);

      if (projectIds.length === 0) {
        console.log(`User ${userId} has no projects yet`);
        return;
      }

      // Join each project room
      for (const projectId of projectIds) {
        const projectRoom = `project_${projectId}`;
        await client.join(projectRoom);
      }

      console.log(`User ${userId} joined ${projectIds.length} project rooms`);
    } catch (error: any) {
      console.error(
        `Failed to join project rooms for user ${userId}:`,
        error?.message || error,
      );
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
          console.log(`[WebSocket] User ${userId} went completely OFFLINE`);
          console.log(`Total online users: ${this.onlineUsers.size}`);
        } else {
          console.log(`[WebSocket] User ${userId} disconnected one socket`);
          console.log(
            `   Remaining sockets for this user: ${userSockets.size}`,
          );
        }
      }
    } else {
      console.log(
        `[WebSocket] Unauthenticated client disconnected: ${client.id}`,
      );
    }
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
  /**
   * Emit notification to specific user
   * Returns true if user is online and message was sent
   * Returns false if user is offline (caller should use FCM fallback)
   */
  emitToUser(userId: string, event: string, data: any): boolean {
    const userRoom = `user_${userId}`;
    const isOnline = this.isUserOnline(userId);
    const socketCount = this.onlineUsers.get(userId)?.size || 0;

    console.log(`[WebSocket] Emitting '${event}' to user ${userId}`);
    console.log(`   User status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    console.log(`   Active sockets: ${socketCount}`);
    console.log(`   Room: ${userRoom}`);
    console.log(`   Data type: ${data?.type || 'unknown'}`);

    if (!isOnline) {
      console.log(
        `[WebSocket] User ${userId} not connected - message will be lost!`,
      );
      return false;
    }

    this.server.to(userRoom).emit(event, data);
    console.log(`[WebSocket] Message emitted to room ${userRoom}`);
    return true;
  }

  /**
   * Emit to project/workspace members
   */
  emitToProject(projectId: string, event: string, data: any) {
    const projectRoom = `project_${projectId}`;
    this.server.to(projectRoom).emit(event, data);
    console.log(`Emitted '${event}' to project ${projectId}`);
  }

  /**
   * Check if user is online (has active WebSocket connection)
   * IMPORTANT: This is checked BEFORE sending notification to decide WebSocket vs FCM
   * If returns TRUE → WebSocket delivery (instant)
   * If returns FALSE → FCM delivery (push notification)
   */
  isUserOnline(userId: string): boolean {
    const sockets = this.onlineUsers.get(userId);
    const isOnline = !!sockets && sockets.size > 0;
    console.log(
      `🔍 [WebSocket] Checking user ${userId} online status: ${isOnline ? 'ONLINE' : 'OFFLINE'} (${sockets?.size || 0} sockets)`,
    );

    // CRITICAL: This determines notification delivery method!
    // - ONLINE = WebSocket (real-time, in-app)
    // - OFFLINE = FCM (push notification, system tray)
    return isOnline;
  }
}
