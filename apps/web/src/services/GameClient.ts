import { socketClient } from './SocketClient';
import { ClientAction } from '@monopoly/shared';
import { useRoomStore, useUiStore } from '../store';

export class GameClient {
  public static sendAction(action: ClientAction) {
    const socket = socketClient.getSocket();
    const roomId = useRoomStore.getState().roomId;
    
    if (!socket || !roomId) {
      useUiStore.getState().showError('Cannot send action: not connected to a room');
      return;
    }

    socket.emit('game_action', { roomId, action }, (res: any) => {
      if (!res.success && res.error) {
        useUiStore.getState().showError(`Action Failed: ${res.error.message}`);
      }
    });
  }

  public static requestFullState() {
    // In a fully integrated environment, we might ask the server to re-broadcast state
    // For now, this is a placeholder if a checksum mismatch were to occur.
  }
}
