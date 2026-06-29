import React from 'react';
import { useGameStore, useConnectionStore } from '../store';
import { Board } from '../components/Board';
import { PlayerPanel } from '../components/PlayerPanel';
import { EventLog } from '../components/EventLog';
import { ActionButtons } from '../components/ActionButtons';

export const Game: React.FC = () => {
  const { gameState } = useGameStore();
  const { status } = useConnectionStore();

  if (status !== 'connected') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        Reconnecting...
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        Loading Game State...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-gray-900 text-gray-100 overflow-hidden">
      {/* Left Sidebar - Players & Event Log */}
      <div className="w-80 flex flex-col border-r border-gray-700 bg-gray-800 p-4 space-y-4 shadow-xl z-10">
        <PlayerPanel />
        <EventLog />
      </div>

      {/* Center - Board */}
      <div className="flex-1 flex items-center justify-center relative bg-board-bg overflow-hidden p-8 shadow-inner">
        <Board />
      </div>

      {/* Right Sidebar - Actions & Details */}
      <div className="w-80 flex flex-col border-l border-gray-700 bg-gray-800 p-4 shadow-xl z-10">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white border-b border-gray-700 pb-2 mb-4">Turn Timer</h2>
          {/* Stub for Turn Timer */}
          <div className="text-3xl font-mono text-monopoly-red text-center mb-8">
            00:30
          </div>
          
          <ActionButtons />
        </div>
      </div>
    </div>
  );
};
