// =============================================================================
// tests/unit/engine/BuyProperty.test.ts
// Exhaustive tests for ActionType.BUY_PROPERTY action.
//
// Coverage:
//   - Successful purchase (Property, Railroad, Utility)
//   - Bank transactions and property inventory updates
//   - TileState ownership changes
//   - Monopoly completion detection (MONOPOLY_COMPLETED event)
//   - Validation: insufficient funds, already owned, wrong phase, wrong player
//   - Immutability and replay determinism
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../../src/engine/GameEngine.js';
import type { CreateGameParams } from '../../../src/engine/types.js';
import {
  ActionType,
  GamePhase,
  TurnPhase,
  EventType,
  TileType,
  DecisionType,
  ErrorCode,
  WinCondition,
} from '@monopoly/shared';
import type {
  PlayerId,
  GameState,
  MapConfig,
  ClientAction,
  PropertyPurchasedPayload,
  MonopolyCompletedPayload,
  TileId,
} from '@monopoly/shared';

// ---------------------------------------------------------------------------
// Test map
// ---------------------------------------------------------------------------
function createBuyPropertyTestMap(): MapConfig {
  return {
    schemaVersion: '1.0',
    meta: {
      id: 'buy-property-test-map',
      name: 'Buy Property Test Map',
      playerTokens: [
        { id: 'token-1', name: 'Token 1', iconUrl: '' },
        { id: 'token-2', name: 'Token 2', iconUrl: '' },
      ],
    },
    bank: {
      startingMoney: 1500,
      infiniteMoney: true,
      initialHouses: 32,
      initialHotels: 12,
      goReward: 200,
    },
    board: {
      size: 5,
      jailTileIndex: 1,
      tiles: [
        { id: 'go', index: 0, type: TileType.GO, name: 'GO' },
        {
          id: 'prop-1',
          index: 1,
          type: TileType.PROPERTY,
          name: 'Prop 1',
          propertyData: {
            groupId: 'group-a',
            price: 100,
            rents: { base: 10, colorGroup: 20, oneHouse: 30, twoHouses: 40, threeHouses: 50, fourHouses: 60, hotel: 70 },
            houseCost: 50,
            hotelCost: 50,
            mortgageValue: 50,
            unmortgageCost: 55,
          },
        },
        {
          id: 'prop-2',
          index: 2,
          type: TileType.PROPERTY,
          name: 'Prop 2',
          propertyData: {
            groupId: 'group-a',
            price: 150,
            rents: { base: 10, colorGroup: 20, oneHouse: 30, twoHouses: 40, threeHouses: 50, fourHouses: 60, hotel: 70 },
            houseCost: 50,
            hotelCost: 50,
            mortgageValue: 75,
            unmortgageCost: 83,
          },
        },
        {
          id: 'railroad',
          index: 3,
          type: TileType.RAILROAD,
          name: 'Railroad',
          railroadData: {
            price: 200,
            rents: [25, 50, 100, 200],
            mortgageValue: 100,
            unmortgageCost: 110,
          },
        },
        {
          id: 'utility',
          index: 4,
          type: TileType.UTILITY,
          name: 'Utility',
          utilityData: {
            price: 150,
            diceMultipliers: [4, 10],
            mortgageValue: 75,
            unmortgageCost: 83,
          },
        },
      ],
      propertyGroups: [
        { id: 'group-a', name: 'Group A', color: '#ff0000', tileIds: ['prop-1', 'prop-2'] },
      ],
    },
    cards: {
      chance: [],
      communityChest: [],
    },
    rules: {
      auctionOnDecline: true,
      evenBuildingRequired: true,
      maxTurnsInJail: 3,
      jailFine: 50,
      doublesForJailRelease: true,
      freeParkingMoney: false,
      bankruptcyToBank: false,
      winCondition: WinCondition.LAST_STANDING,
      auctionConfig: { durationSeconds: 30, extensionSeconds: 10, extensionThreshold: 5, minBidIncrement: 10, maxExtensions: 10 },
    },
  };
}

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------
const PLAYER_1 = 'player-1' as PlayerId;
const PLAYER_2 = 'player-2' as PlayerId;

function buyAction(overrides?: Partial<ClientAction>): ClientAction {
  return {
    actionId: 'action-buy-123',
    type: ActionType.BUY_PROPERTY,
    roomId: 'room-1',
    clientTs: 100000,
    payload: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('BUY_PROPERTY action', () => {
  let engine: GameEngine;
  let mapConfig: MapConfig;
  let initialState: GameState;

  beforeEach(() => {
    mapConfig = createBuyPropertyTestMap();
    engine = new GameEngine();

    const createParams: CreateGameParams = {
      gameId: 'game-1',
      roomId: 'room-1',
      mapConfig,
      players: [
        { userId: 'u1', playerId: PLAYER_1, displayName: 'P1', avatarUrl: '', tokenId: 'token-1' },
        { userId: 'u2', playerId: PLAYER_2, displayName: 'P2', avatarUrl: '', tokenId: 'token-2' },
      ],
      rngSeed: 'seed-123',
      createdAt: 10000,
    };

    const { newState } = GameEngine.createInitialState(createParams);
    // Put game in PURCHASE_DECISION phase for PLAYER_1 on prop-1
    initialState = {
      ...newState,
      gamePhase: GamePhase.IN_PROGRESS,
      turn: {
        ...newState.turn,
        currentPlayerId: PLAYER_1,
        phase: TurnPhase.PURCHASE_DECISION,
        pendingDecision: {
          type: DecisionType.PURCHASE,
          tileId: 'prop-1' as TileId,
        },
      },
    };
  });

  // ==========================================================================
  //  Successful Purchases
  // ==========================================================================
  describe('Successful purchase (Property)', () => {
    it('deducts the correct price from the player', () => {
      const p1MoneyBefore = initialState.players[PLAYER_1]!.money;
      const { newState } = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
      
      expect(newState.players[PLAYER_1]!.money).toBe(p1MoneyBefore - 100);
    });

    it('transfers the purchase price to the bank', () => {
      const bankMoneyBefore = initialState.bank.money;
      // Note: with infiniteMoney=true, bank.money doesn't strictly matter for mechanics,
      // but ActionProcessor still updates the counter. Wait, the handler sets it back
      // if infiniteMoney is true.
      // Let's modify state to have infiniteMoney=false to test this.
      const state = { ...initialState, bank: { ...initialState.bank, infiniteMoney: false, money: 10000 } };
      const { newState } = engine.apply(state, buyAction(), mapConfig, PLAYER_1);
      expect(newState.bank.money).toBe(10000 + 100);
    });

    it('adds the tileId to the player\'s properties array', () => {
      const { newState } = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
      expect(newState.players[PLAYER_1]!.properties).toContain('prop-1');
    });

    it('sets the TileState ownerId to the purchasing player', () => {
      const { newState } = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
      expect(newState.board.tiles['prop-1']!.ownerId).toBe(PLAYER_1);
    });

    it('transitions turn phase to POST_ROLL', () => {
      const { newState } = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
      expect(newState.turn.phase).toBe(TurnPhase.POST_ROLL);
    });

    it('clears the pendingDecision', () => {
      const { newState } = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
      expect(newState.turn.pendingDecision).toBeNull();
    });

    it('emits a PROPERTY_PURCHASED event with correct payload', () => {
      const action = buyAction();
      const { events } = engine.apply(initialState, action, mapConfig, PLAYER_1);
      expect(events).toHaveLength(1);
      const ev = events[0]!;
      expect(ev.type).toBe(EventType.PROPERTY_PURCHASED);
      expect(ev.id).toBe(`${action.actionId}::PROPERTY_PURCHASED`);
      const payload = ev.payload as PropertyPurchasedPayload;
      expect(payload.playerId).toBe(PLAYER_1);
      expect(payload.tileId).toBe('prop-1');
      expect(payload.price).toBe(100);
    });
  });

  describe('Successful purchase (Railroad)', () => {
    let rrState: GameState;
    beforeEach(() => {
      rrState = {
        ...initialState,
        turn: {
          ...initialState.turn,
          pendingDecision: { type: DecisionType.PURCHASE, tileId: 'railroad' as TileId },
        },
      };
    });

    it('deducts the correct price from the player', () => {
      const p1MoneyBefore = rrState.players[PLAYER_1]!.money;
      const { newState } = engine.apply(rrState, buyAction(), mapConfig, PLAYER_1);
      expect(newState.players[PLAYER_1]!.money).toBe(p1MoneyBefore - 200);
    });

    it('updates TileState ownership correctly', () => {
      const { newState } = engine.apply(rrState, buyAction(), mapConfig, PLAYER_1);
      expect(newState.board.tiles['railroad']!.ownerId).toBe(PLAYER_1);
    });
  });

  describe('Successful purchase (Utility)', () => {
    let utState: GameState;
    beforeEach(() => {
      utState = {
        ...initialState,
        turn: {
          ...initialState.turn,
          pendingDecision: { type: DecisionType.PURCHASE, tileId: 'utility' as TileId },
        },
      };
    });

    it('deducts the correct price from the player', () => {
      const p1MoneyBefore = utState.players[PLAYER_1]!.money;
      const { newState } = engine.apply(utState, buyAction(), mapConfig, PLAYER_1);
      expect(newState.players[PLAYER_1]!.money).toBe(p1MoneyBefore - 150);
    });

    it('updates TileState ownership correctly', () => {
      const { newState } = engine.apply(utState, buyAction(), mapConfig, PLAYER_1);
      expect(newState.board.tiles['utility']!.ownerId).toBe(PLAYER_1);
    });
  });

  // ==========================================================================
  //  Monopoly Completion
  // ==========================================================================
  describe('Monopoly Completion', () => {
    let almostMonopolyState: GameState;

    beforeEach(() => {
      // P1 already owns prop-1, is deciding to buy prop-2
      almostMonopolyState = {
        ...initialState,
        players: {
          ...initialState.players,
          [PLAYER_1]: {
            ...initialState.players[PLAYER_1]!,
            properties: ['prop-1' as TileId],
          },
        },
        board: {
          ...initialState.board,
          tiles: {
            ...initialState.board.tiles,
            'prop-1': { ...initialState.board.tiles['prop-1']!, ownerId: PLAYER_1 },
          },
        },
        turn: {
          ...initialState.turn,
          pendingDecision: { type: DecisionType.PURCHASE, tileId: 'prop-2' as TileId },
        },
      };
    });

    it('emits MONOPOLY_COMPLETED event when purchasing the final group property', () => {
      const action = buyAction();
      const { events } = engine.apply(almostMonopolyState, action, mapConfig, PLAYER_1);
      
      expect(events).toHaveLength(2); // PURCHASED and MONOPOLY_COMPLETED
      
      expect(events[0]!.type).toBe(EventType.PROPERTY_PURCHASED);
      expect(events[1]!.type).toBe(EventType.MONOPOLY_COMPLETED);
      
      const mcEvent = events[1]!;
      expect(mcEvent.id).toBe(`${action.actionId}::MONOPOLY_COMPLETED`);
      
      const payload = mcEvent.payload as MonopolyCompletedPayload;
      expect(payload.playerId).toBe(PLAYER_1);
      expect(payload.groupId).toBe('group-a');
    });

    it('does NOT emit MONOPOLY_COMPLETED when buying a utility (no group id)', () => {
      const utState = {
        ...almostMonopolyState,
        turn: {
          ...almostMonopolyState.turn,
          pendingDecision: { type: DecisionType.PURCHASE, tileId: 'utility' as TileId },
        },
      };
      const { events } = engine.apply(utState, buyAction(), mapConfig, PLAYER_1);
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe(EventType.PROPERTY_PURCHASED);
    });
  });

  // ==========================================================================
  //  Validation Failures
  // ==========================================================================
  describe('Validation Failures', () => {
    it('returns an error if it is not the active player', () => {
      // P1's turn, P2 tries to buy
      const result = engine.validate(initialState, buyAction(), mapConfig, PLAYER_2);
      expect(result.valid).toBe(false);
      expect((result as any).code).toBe(ErrorCode.E_NOT_YOUR_TURN);
    });

    it('returns an error if the phase is not PURCHASE_DECISION', () => {
      const state = {
        ...initialState,
        turn: { ...initialState.turn, phase: TurnPhase.POST_ROLL },
      };
      const result = engine.validate(state, buyAction(), mapConfig, PLAYER_1);
      expect(result.valid).toBe(false);
      expect((result as any).code).toBe(ErrorCode.E_INVALID_PHASE);
    });

    it('returns an error if there is no pendingDecision', () => {
      const state = {
        ...initialState,
        turn: { ...initialState.turn, pendingDecision: null },
      };
      const result = engine.validate(state, buyAction(), mapConfig, PLAYER_1);
      expect(result.valid).toBe(false);
      expect((result as any).code).toBe(ErrorCode.E_INVALID_PHASE);
    });

    it('returns an error if pendingDecision is not PURCHASE', () => {
      const state = {
        ...initialState,
        turn: {
          ...initialState.turn,
          pendingDecision: { type: DecisionType.JAIL, tileId: 'prop-1' as TileId },
        },
      };
      const result = engine.validate(state, buyAction(), mapConfig, PLAYER_1);
      expect(result.valid).toBe(false);
      expect((result as any).code).toBe(ErrorCode.E_INVALID_PHASE);
    });

    it('returns an error if property is already owned', () => {
      const state = {
        ...initialState,
        board: {
          ...initialState.board,
          tiles: {
            ...initialState.board.tiles,
            'prop-1': { ...initialState.board.tiles['prop-1']!, ownerId: PLAYER_2 },
          },
        },
      };
      const result = engine.validate(state, buyAction(), mapConfig, PLAYER_1);
      expect(result.valid).toBe(false);
      expect((result as any).code).toBe(ErrorCode.E_PROPERTY_OWNED);
    });

    it('returns an error if player has insufficient funds', () => {
      const state = {
        ...initialState,
        players: {
          ...initialState.players,
          [PLAYER_1]: { ...initialState.players[PLAYER_1]!, money: 50 }, // prop-1 costs 100
        },
      };
      const result = engine.validate(state, buyAction(), mapConfig, PLAYER_1);
      expect(result.valid).toBe(false);
      expect((result as any).code).toBe(ErrorCode.E_DEBT_RECOVERY);
    });
  });

  // ==========================================================================
  //  Immutability & Determinism
  // ==========================================================================
  describe('Immutability and Determinism', () => {
    it('does not mutate the input state', () => {
      const stateJSON = JSON.stringify(initialState);
      engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
      expect(JSON.stringify(initialState)).toBe(stateJSON);
    });

    it('returns a new object reference', () => {
      const { newState } = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
      expect(newState).not.toBe(initialState);
      expect(newState.players).not.toBe(initialState.players);
      expect(newState.board).not.toBe(initialState.board);
      expect(newState.turn).not.toBe(initialState.turn);
    });

    it('increments version exactly by 1', () => {
      const { newState } = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
      expect(newState.version).toBe(initialState.version + 1);
    });

    it('replay determinism: identical initial state + action = identical result', () => {
      const res1 = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
      const res2 = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
      expect(JSON.stringify(res1)).toEqual(JSON.stringify(res2));
    });
  });
});
