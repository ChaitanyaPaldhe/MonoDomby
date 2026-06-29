import React from 'react';
import { useGameStore, useConnectionStore } from '../store';

export const PlayerPanel: React.FC = () => {
  const { gameState } = useGameStore();
  const { playerId: myId } = useConnectionStore();

  if (!gameState) return null;

  return (
    <div className="flex flex-col flex-none space-y-2 h-1/2 overflow-y-auto">
      <h2 className="text-xl font-bold text-white border-b border-gray-700 pb-2 sticky top-0 bg-gray-800">Players</h2>
      {gameState.players.map((p) => {
        const isMe = p.id === myId;
        const isTurn = gameState.turn.currentPlayerId === p.id;
        
        return (
          <div 
            key={p.id} 
            data-testid={`player-panel-item-${p.id}`}
            className={`p-3 rounded-lg border ${isTurn ? 'border-monopoly-blue bg-blue-900/20' : 'border-gray-700 bg-gray-900'} relative transition-colors`}
          >
            {isMe && <span className="absolute -top-2 -right-2 bg-monopoly-yellow text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">YOU</span>}
            <div className="flex justify-between items-center">
              <span className="font-medium truncate pr-4 text-gray-200">{p.id}</span>
              <span className="font-mono text-monopoly-green font-bold">${p.money}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Tile: {p.position}
            </div>
          </div>
        );
      })}
    </div>
  );
};
