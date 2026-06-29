import { socketClient } from './SocketClient';
import { useUiStore } from '../store';

export class LobbyClient {
  public static createRoom(roomId: string) {
    const socket = socketClient.getSocket();
    if (!socket) return;
    
    socket.emit('create_room', { roomId }, (res) => {
      if (!res.success && res.error) {
        useUiStore.getState().showError(`Failed to create room: ${res.error.message}`);
      }
    });
  }

  public static joinRoom(roomId: string) {
    const socket = socketClient.getSocket();
    if (!socket) return;
    
    socket.emit('join_room', { roomId }, (res) => {
      if (!res.success && res.error) {
        useUiStore.getState().showError(`Failed to join room: ${res.error.message}`);
      }
    });
  }

  public static leaveRoom(roomId: string) {
    const socket = socketClient.getSocket();
    if (!socket) return;

    socket.emit('leave_room', { roomId });
  }
}
