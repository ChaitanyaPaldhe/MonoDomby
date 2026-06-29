import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '@monopoly/engine';
import { EngineValidationError } from '@monopoly/engine';
import { ActionType, EventType, TurnPhase, GamePhase, WinCondition } from '@monopoly/shared';
import type { MapConfig } from '@monopoly/maps';
import type { GameState, PlayerId, ClientAction } from '@monopoly/shared';;

describe('END_TURN Action', () => {
  const P1 = 'player-1' as PlayerId;
  const P2 = 'player-2' as PlayerId;
  const P3 = 'player-3' as PlayerId;

  let engine: GameEngine;
  let config: MapConfig;
  let baseState: GameState;

  beforeEach(() => {
    config = {
      meta: { id: 'test-map' },
      gameRules: { turnDurationMs: 60000 },
      rules: { winCondition: WinCondition.LAST_STANDING },
      board: {
        tiles: [{ id: 'go', index: 0, type: 'GO' }],
      },
    } as any;

    baseState = {
      id: 'game-1' as any,
      roomId: 'room-1' as any,
      version: 1,
      phase: GamePhase.IN_PROGRESS,
      players: {
        [P1]: { playerId: P1, isBankrupt: false, jailState: null },
        [P2]: { playerId: P2, isBankrupt: false, jailState: null },
        [P3]: { playerId: P3, isBankrupt: false, jailState: null },
      },
      playerOrder: [P1, P2, P3],
      turn: {
        currentPlayerId: P1,
        turnNumber: 1,
        phase: TurnPhase.POST_ROLL,
        diceValues: [3, 4],
        isDoubles: false,
        consecutiveDoubles: 0,
        turnExpiresAt: 1000,
        pendingDecision: null,
      },
      activeTrades: {},
      auction: null,
      board: { tiles: {} },
      bank: { houses: 32, hotels: 12 },
    } as any;

    engine = new GameEngine();
  });

  const createAction = (ts: number): ClientAction => ({
    actionId: `action-${ts}`,
    clientTs: ts,
    type: ActionType.END_TURN,
    payload: {},
  });

  describe('Validation', () => {
    it('fails if player is not the active player', () => {
      try {
        engine.apply(baseState, createAction(2000), config, P2);
        expect.fail('Should have thrown EngineValidationError');
      } catch (e: any) {
        expect(e).toBeInstanceOf(EngineValidationError);
        expect(e.code).toBe('E_NOT_YOUR_TURN');
      }
    });

    it('fails if the turn phase is not POST_ROLL', () => {
      const state = { ...baseState, turn: { ...baseState.turn, phase: TurnPhase.PRE_ROLL } };
      try {
        engine.apply(state, createAction(2000), config, P1);
        expect.fail('Should have thrown EngineValidationError');
      } catch (e: any) {
        expect(e).toBeInstanceOf(EngineValidationError);
        expect(e.code).toBe('E_INVALID_PHASE');
      }
    });

    it('fails if there is a pending decision', () => {
      const state = { ...baseState, turn: { ...baseState.turn, pendingDecision: { type: 'PURCHASE' } as any } };
      try {
        engine.apply(state, createAction(2000), config, P1);
        expect.fail('Should have thrown EngineValidationError');
      } catch (e: any) {
        expect(e).toBeInstanceOf(EngineValidationError);
        expect(e.code).toBe('E_PENDING_DECISION');
      }
    });

    it('fails if there is an active auction', () => {
      const state = { ...baseState, auction: { id: 'auc-1' } as any };
      try {
        engine.apply(state, createAction(2000), config, P1);
        expect.fail('Should have thrown EngineValidationError');
      } catch (e: any) {
        expect(e).toBeInstanceOf(EngineValidationError);
        expect(e.code).toBe('E_INVALID_ACTION');
        expect(e.message).toMatch(/auction is active/);
      }
    });

    it('fails if there are active trades', () => {
      const state = { ...baseState, activeTrades: { 'trade-1': {} as any } };
      try {
        engine.apply(state, createAction(2000), config, P1);
        expect.fail('Should have thrown EngineValidationError');
      } catch (e: any) {
        expect(e).toBeInstanceOf(EngineValidationError);
        expect(e.code).toBe('E_INVALID_ACTION');
        expect(e.message).toMatch(/active trades/);
      }
    });
  });

  describe('Normal Turn End (no doubles)', () => {
    it('advances to the next player and transitions to PRE_ROLL', () => {
      const action = createAction(2000);
      const result = engine.apply(baseState, action, config, P1);
      
      const { newState: state } = result;
      expect(state.turn.currentPlayerId).toBe(P2);
      expect(state.turn.phase).toBe(TurnPhase.PRE_ROLL);
      expect(state.turn.turnNumber).toBe(2);
      expect(state.turn.isDoubles).toBe(false);
      expect(state.turn.consecutiveDoubles).toBe(0);
      expect(state.turn.turnExpiresAt).toBe(2000 + 60000);
    });

    it('emits TURN_ENDED and TURN_STARTED events', () => {
      const action = createAction(2000);
      const result = engine.apply(baseState, action, config, P1);
      
      const { events } = result;
      expect(events).toHaveLength(2);
      
      expect(events[0]!.type).toBe(EventType.TURN_ENDED);
      expect((events[0]!.payload as any).playerId).toBe(P1);

      expect(events[1]!.type).toBe(EventType.TURN_STARTED);
      expect((events[1]!.payload as any).playerId).toBe(P2);
    });

    it('skips bankrupt players automatically', () => {
      const state = {
        ...baseState,
        players: {
          ...baseState.players,
          [P2]: { ...baseState.players[P2]!, isBankrupt: true },
        },
      };
      const result = engine.apply(state, createAction(2000), config, P1);
      expect(result.newState.turn.currentPlayerId).toBe(P3);
    });

    it('wraps around to the first player after the last player', () => {
      const state = { ...baseState, turn: { ...baseState.turn, currentPlayerId: P3 } };
      const result = engine.apply(state, createAction(2000), config, P3);
      expect(result.newState.turn.currentPlayerId).toBe(P1);
    });
  });

  describe('Doubles Extra Turn', () => {
    it('grants another turn to the same player if they rolled doubles and are not in jail', () => {
      const state = {
        ...baseState,
        turn: { ...baseState.turn, isDoubles: true, consecutiveDoubles: 1 },
      };
      const action = createAction(2000);
      const result = engine.apply(state, action, config, P1);
      
      expect(result.newState.turn.currentPlayerId).toBe(P1); // Same player
      expect(result.newState.turn.phase).toBe(TurnPhase.PRE_ROLL);
      expect(result.newState.turn.consecutiveDoubles).toBe(2); // Kept the incremented value
      expect(result.newState.turn.isDoubles).toBe(false); // Reset for the new roll
      expect(result.newState.turn.turnNumber).toBe(1); // Still the same turn number logically
    });

    it('emits TURN_ENDED, EXTRA_TURN_GRANTED, and TURN_STARTED', () => {
      const state = {
        ...baseState,
        turn: { ...baseState.turn, isDoubles: true },
      };
      const result = engine.apply(state, createAction(2000), config, P1);
      
      expect(result.events).toHaveLength(3);
      expect(result.events[0]!.type).toBe(EventType.TURN_ENDED);
      expect(result.events[1]!.type).toBe(EventType.EXTRA_TURN_GRANTED);
      expect(result.events[2]!.type).toBe(EventType.TURN_STARTED);
    });

    it('advances to the next player if they rolled doubles but are in jail', () => {
      const state = {
        ...baseState,
        players: {
          ...baseState.players,
          [P1]: { ...baseState.players[P1]!, jailState: { turnsServed: 0, reason: 'DOUBLES', jailedAt: 1000 } as any },
        },
        turn: { ...baseState.turn, isDoubles: true, consecutiveDoubles: 3 }, // E.g., triple doubles
      };
      const result = engine.apply(state, createAction(2000), config, P1);
      
      expect(result.newState.turn.currentPlayerId).toBe(P2); // Next player!
      expect(result.newState.turn.phase).toBe(TurnPhase.PRE_ROLL);
      
      // Should not grant extra turn
      expect(result.events.find(e => e.type === EventType.EXTRA_TURN_GRANTED)).toBeUndefined();
    });
  });

  describe('Immutability and Determinism', () => {
    it('does not mutate the input state', () => {
      const originalStateJson = JSON.stringify(baseState);
      engine.apply(baseState, createAction(2000), config, P1);
      expect(JSON.stringify(baseState)).toBe(originalStateJson);
    });

    it('increments version exactly by 1 (machine transition + action)', () => {
      const result = engine.apply(baseState, createAction(2000), config, P1);
      expect(result.newState.version).toBe(baseState.version + 1); // 1 from StateMachine
    });

    it('produces identical state for identical input', () => {
      const action = createAction(2000);
      const res1 = engine.apply(baseState, action, config, P1);
      const res2 = engine.apply(baseState, action, config, P1);
      expect(res1).toEqual(res2);
    });
  });
});
