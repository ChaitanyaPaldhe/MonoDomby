import React from 'react';
import { useGameStore, useConnectionStore } from '../store';
import { GameClient } from '../services';
import { ActionType } from '@monopoly/shared';

export const ActionButtons: React.FC = () => {
  const { gameState } = useGameStore();
  const { playerId: myId } = useConnectionStore();

  if (!gameState || gameState.turn.currentPlayerId !== myId) {
    return (
      <div className="text-center text-gray-500 italic p-4 bg-gray-900 rounded-lg border border-gray-800">
        Waiting for your turn...
      </div>
    );
  }

  const phase = gameState.turn.phase;

  const handleRoll = () => {
    GameClient.sendAction({ type: ActionType.ROLL_DICE, playerId: myId, actionId: crypto.randomUUID() } as any);
  };

  const handleEndTurn = () => {
    GameClient.sendAction({ type: ActionType.END_TURN, playerId: myId, actionId: crypto.randomUUID() } as any);
  };

  const handleBuy = () => {
    GameClient.sendAction({
      type: ActionType.BUY_PROPERTY,
      playerId: myId,
      actionId: crypto.randomUUID(),
      tileId: (gameState.turn.pendingDecision as any)?.tileId
    } as any);
  };

  const handleDecline = () => {
    GameClient.sendAction({
      type: ActionType.DECLINE_PROPERTY,
      playerId: myId,
      actionId: crypto.randomUUID(),
      tileId: (gameState.turn.pendingDecision as any)?.tileId
    } as any);
  };

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Available Actions</h2>
      
      {phase === 'PRE_ROLL' && (
        <button
          onClick={handleRoll}
          data-testid="btn-roll-dice"
          className="w-full rounded-md bg-monopoly-red px-4 py-3 text-sm font-bold text-white hover:bg-red-700 shadow-lg transition-transform transform active:scale-95"
        >
          🎲 Roll Dice
        </button>
      )}

      {phase === 'POST_ROLL' && (
        <button
          onClick={handleEndTurn}
          data-testid="btn-end-turn"
          className="w-full rounded-md bg-gray-700 px-4 py-3 text-sm font-bold text-white hover:bg-gray-600 shadow-lg transition-transform transform active:scale-95"
        >
          🛑 End Turn
        </button>
      )}

      {phase === 'PURCHASE_DECISION' && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleBuy}
            data-testid="btn-buy-property"
            className="w-full rounded-md bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700 shadow-lg transition-transform transform active:scale-95"
          >
            💰 Buy Property
          </button>
          <button
            onClick={handleDecline}
            data-testid="btn-decline-property"
            className="w-full rounded-md bg-gray-600 px-4 py-3 text-sm font-bold text-white hover:bg-gray-700 shadow-lg transition-transform transform active:scale-95"
          >
            Decline
          </button>
        </div>
      )}

      {/* Property Management Buttons (Always visible on turn) */}
      <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-700">
        <button className="rounded-md bg-gray-800 border border-gray-600 px-2 py-2 text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors">
          Manage
        </button>
        <button className="rounded-md bg-gray-800 border border-gray-600 px-2 py-2 text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors">
          Trade
        </button>
      </div>
    </div>
  );
};
