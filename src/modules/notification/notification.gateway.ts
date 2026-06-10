// notification.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationDto } from './dto/notification.dto';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // Map: recipientDisplayId → socketId
  private userSocketMap = new Map<string, string>();

  handleConnection(client: Socket) {
    // Client gửi displayId khi connect
    const displayId = client.handshake.query.displayId as string;
    if (displayId) {
      this.userSocketMap.set(displayId, client.id);
    }
  }

  handleDisconnect(client: Socket) {
    // Xóa khỏi map khi disconnect
    for (const [displayId, socketId] of this.userSocketMap.entries()) {
      if (socketId === client.id) {
        this.userSocketMap.delete(displayId);
        break;
      }
    }
  }

  /** Gửi thông báo đến đúng user nếu đang online */
  sendToUser(recipientDisplayId: string, notification: NotificationDto) {
    const socketId = this.userSocketMap.get(recipientDisplayId);
    if (socketId) {
      this.server.to(socketId).emit('new_notification', notification);
    }
    // Nếu offline → không emit, user sẽ fetch khi online lại
  }
}