import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { AdminService } from '../admin/admin.service';
import { NotificationDto } from './dto/notification.dto';

type ClientRole = 'guest' | 'user' | 'admin';

interface RealtimeClientData {
  role: ClientRole;
  displayId?: string;
  adminUsername?: string;
  postRooms: Set<string>;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private userSocketMap = new Map<string, Set<string>>();
  private adminSocketIds = new Set<string>();

  constructor(
    private readonly authService: AuthService,
    private readonly adminService: AdminService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const data: RealtimeClientData = {
      role: 'guest',
      postRooms: new Set<string>(),
    };

    try {
      const authHeader = client.handshake.auth?.token as string | undefined;
      const queryDisplayId = client.handshake.query.displayId as string | undefined;
      const rawToken = this.extractBearerToken(authHeader);
      const masterKey = client.handshake.auth?.masterKey as string | undefined;

      if (rawToken && masterKey) {
        const admin = await this.adminService.validateAdminToken(rawToken);
        const hasValidMasterKey = await this.adminService.verifyMasterKey(masterKey);
        if (admin && hasValidMasterKey) {
          data.role = 'admin';
          data.adminUsername = admin.username;
          this.adminSocketIds.add(client.id);
          await client.join('admin');
        }
      } else if (rawToken) {
        const user = await this.authService.validateAnonymousToken(rawToken);
        if (user) {
          data.role = 'user';
          data.displayId = user.displayId;
          this.addUserSocket(user.displayId, client.id);
          await client.join(`user:${user.displayId}`);
        }
      } else if (queryDisplayId) {
        data.displayId = queryDisplayId;
      }

      client.data.realtime = data;
      await client.join('feed');
      client.emit('realtime:connected', {
        role: data.role,
        displayId: data.displayId ?? null,
        adminUsername: data.adminUsername ?? null,
      });
    } catch {
      client.data.realtime = data;
      await client.join('feed');
      client.emit('realtime:connected', { role: 'guest' });
    }
  }

  handleDisconnect(client: Socket): void {
    const data = client.data.realtime as RealtimeClientData | undefined;
    if (data?.displayId) {
      this.removeUserSocket(data.displayId, client.id);
    }
    if (data?.role === 'admin') {
      this.adminSocketIds.delete(client.id);
    }
  }

  @SubscribeMessage('post:join')
  async joinPost(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { postId?: string },
  ): Promise<{ ok: boolean }> {
    const postId = payload?.postId?.trim();
    if (!postId) return { ok: false };

    const data = client.data.realtime as RealtimeClientData | undefined;
    data?.postRooms.add(postId);
    await client.join(`post:${postId}`);
    return { ok: true };
  }

  @SubscribeMessage('post:leave')
  async leavePost(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { postId?: string },
  ): Promise<{ ok: boolean }> {
    const postId = payload?.postId?.trim();
    if (!postId) return { ok: false };

    const data = client.data.realtime as RealtimeClientData | undefined;
    data?.postRooms.delete(postId);
    await client.leave(`post:${postId}`);
    return { ok: true };
  }

  sendToUser(recipientDisplayId: string, notification: NotificationDto): void {
    this.server
      .to(`user:${recipientDisplayId}`)
      .emit('notification:new', notification);

    const socketIds = this.userSocketMap.get(recipientDisplayId);
    socketIds?.forEach((socketId) => {
      this.server.to(socketId).emit('new_notification', notification);
    });
  }

  emitFeedEvent(event: string, payload: unknown): void {
    this.server.to('feed').emit(event, payload);
  }

  emitPostEvent(postId: string, event: string, payload: unknown): void {
    this.server.to(`post:${postId}`).emit(event, payload);
  }

  emitAdminEvent(event: string, payload: unknown): void {
    this.server.to('admin').emit(event, payload);
  }

  private extractBearerToken(value?: string): string | null {
    if (!value) return null;
    return value.startsWith('Bearer ') ? value.replace('Bearer ', '').trim() : value;
  }

  private addUserSocket(displayId: string, socketId: string): void {
    const socketIds = this.userSocketMap.get(displayId) ?? new Set<string>();
    socketIds.add(socketId);
    this.userSocketMap.set(displayId, socketIds);
  }

  private removeUserSocket(displayId: string, socketId: string): void {
    const socketIds = this.userSocketMap.get(displayId);
    if (!socketIds) return;
    socketIds.delete(socketId);
    if (socketIds.size === 0) {
      this.userSocketMap.delete(displayId);
    }
  }
}
