import React, { useEffect } from 'react';
import { useConnectionStore, useRoomStore, useGameStore, useUiStore } from '../store';

export const DebugOverlay: React.FC = () => {
  const { showDebugOverlay, toggleDebug } = useUiStore();
  const connStore = useConnectionStore();
  const roomStore = useRoomStore();
  const gameStore = useGameStore();

  // Press ~ to toggle debug overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`' || e.key === '~') {
        toggleDebug();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDebug]);

  if (!showDebugOverlay) return null;

  const state = gameStore.gameState;

  return (
    <div className="fixed top-0 right-0 z-50 w-80 bg-black/90 p-4 text-xs font-mono text-green-400 border-l border-b border-green-500/30 shadow-2xl backdrop-blur-sm pointer-events-none">
      <div className="font-bold text-white mb-2 border-b border-green-500/30 pb-1">Developer Overlay</div>
      <div className="space-y-1">
        <div className="flex justify-between"><span>Socket:</span> <span className="text-white" data-testid="socket-status">{connStore.status}</span></div>
        <div className="flex justify-between"><span>Ping:</span> <span className="text-white">{connStore.ping}ms</span></div>
        <div className="flex justify-between"><span>Room ID:</span> <span className="text-white truncate max-w-[120px]" data-testid="room-id">{roomStore.roomId || 'N/A'}</span></div>
        <div className="flex justify-between"><span>Player ID:</span> <span className="text-white truncate max-w-[120px]">{connStore.playerId || 'N/A'}</span></div>
        
        {state ? (
          <>
            <div className="border-t border-green-500/30 my-2 pt-1"></div>
            <div className="flex justify-between"><span>Version:</span> <span className="text-white" data-testid="version">{state.version}</span></div>
            <div className="flex justify-between"><span>Checksum:</span> <span className="text-white truncate max-w-[100px]" data-testid="checksum">{state.checksum}</span></div>
            <div className="flex justify-between"><span>Phase:</span> <span className="text-white" data-testid="phase">{state.turn.phase}</span></div>
            <div className="flex justify-between"><span>Turn:</span> <span className="text-white truncate max-w-[120px]" data-testid="current-player">{state.turn.currentPlayerId}</span></div>
            <div className="flex justify-between"><span>Pending Decision:</span> <span className="text-white" data-testid="pending-decision">{state.pendingDecision ? 'YES' : 'NO'}</span></div>
            <div className="flex justify-between"><span>Replay Cursor:</span> <span className="text-white">{gameStore.eventLog.length}</span></div>
          </>
        ) : (
          <div className="text-gray-500 mt-2">No Game State</div>
        )}
      </div>
    </div>
  );
};
