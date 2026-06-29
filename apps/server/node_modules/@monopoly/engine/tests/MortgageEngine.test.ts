import { test, expect, describe } from 'vitest';
import { MortgageEngine } from '../src/MortgageEngine.js';
import { MortgagePlanner } from '../src/MortgagePlanner.js';
import { GameState, PlayerId, TileId, EventType, TurnPhase } from '@monopoly/shared';

// Minimal mock config for testing
const mockConfig: any = {
  board: {
    tiles: [
      { id: 'boardwalk', type: 'PROPERTY', propertyData: { groupId: 'dark-blue', houseCost: 200, mortgageValue: 200, unmortgageCost: 220 } },
      { id: 'park-place', type: 'PROPERTY', propertyData: { groupId: 'dark-blue', houseCost: 200, mortgageValue: 175, unmortgageCost: 193 } },
    ]
  },
  rules: {
    mortgagedPropertyValuation: 0.5
  }
};

const createMockState = (): GameState => ({
  id: 'game-1',
  roomId: 'room-1',
  status: 'PLAYING' as any,
  bank: { money: 20580, houses: 32, hotels: 12, infiniteMoney: true },
  players: {
    'p1': {
      id: 'p1' as PlayerId,
      money: 1000,
      position: 0,
      properties: ['boardwalk' as TileId],
      isBankrupt: false,
      jailState: null,
      getOutOfJailCards: 0,
      netWorth: 1000,
      isConnected: true,
      isSpectator: false,
      hasRolled: false,
      userId: 'u1'
    } as any,
    'p2': {
      id: 'p2' as PlayerId,
      money: 1000,
      position: 0,
      properties: [],
      isBankrupt: false,
      jailState: null,
      getOutOfJailCards: 0,
      netWorth: 1000,
      isConnected: true,
      isSpectator: false,
      hasRolled: false,
      userId: 'u2'
    } as any
  },
  board: {
    tiles: {
      'boardwalk': { tileId: 'boardwalk' as TileId, ownerId: 'p1' as PlayerId, houses: 0, hasHotel: false, isMortgaged: false },
      'park-place': { tileId: 'park-place' as TileId, ownerId: null, houses: 0, hasHotel: false, isMortgaged: false }
    }
  },
  turn: {
    activePlayerId: 'p1' as PlayerId,
    phase: TurnPhase.POST_ROLL,
    turnIndex: 1,
    rollCount: 1,
    pendingDecision: null
  },
  cardDecks: { chance: [], communityChest: [], chanceDiscard: [], communityChestDiscard: [] },
  history: [],
  logs: [],
  version: 1,
  schemaVersion: '1.0'
});

describe('MortgageEngine and Planner', () => {
  test('mortgage property successfully', () => {
    const state = createMockState();
    const action = { actionId: 'act-1', type: 'MORTGAGE_PROPERTY' as const, playerId: 'p1' as PlayerId, clientTs: 123, payload: { tileId: 'boardwalk' } };

    const plan = MortgagePlanner.planMortgageProperty(state, mockConfig, 'boardwalk' as TileId, 'p1' as PlayerId, 'act-1', 123);
    const { newState, events } = MortgageEngine.applyMortgagePlan(state, plan, mockConfig, 'p1' as PlayerId);

    expect(newState.board.tiles['boardwalk'].isMortgaged).toBe(true);
    expect(newState.players['p1'].money).toBe(1200); // 1000 + 200
    expect(events.length).toBe(1);
    expect(events[0].type).toBe(EventType.PROPERTY_MORTGAGED);
  });

  test('unmortgage property successfully', () => {
    const state = createMockState();
    state.board.tiles['boardwalk'].isMortgaged = true;
    const action = { actionId: 'act-1', type: 'UNMORTGAGE_PROPERTY' as const, playerId: 'p1' as PlayerId, clientTs: 123, payload: { tileId: 'boardwalk' } };

    const plan = MortgagePlanner.planUnmortgageProperty(state, mockConfig, 'boardwalk' as TileId, 'p1' as PlayerId, 'act-1', 123);
    const { newState, events } = MortgageEngine.applyMortgagePlan(state, plan, mockConfig, 'p1' as PlayerId);

    expect(newState.board.tiles['boardwalk'].isMortgaged).toBe(false);
    expect(newState.players['p1'].money).toBe(780); // 1000 - 220
    expect(events.length).toBe(1);
    expect(events[0].type).toBe(EventType.PROPERTY_UNMORTGAGED);
  });

  test('cannot mortgage unowned property', () => {
    const state = createMockState();
    expect(() => MortgagePlanner.planMortgageProperty(state, mockConfig, 'boardwalk' as TileId, 'p2' as PlayerId, 'act-1', 123))
      .toThrow('Player does not own this property');
  });

  test('cannot mortgage with houses', () => {
    const state = createMockState();
    state.board.tiles['boardwalk'].houses = 1;
    expect(() => MortgagePlanner.planMortgageProperty(state, mockConfig, 'boardwalk' as TileId, 'p1' as PlayerId, 'act-1', 123))
      .toThrow('Cannot mortgage property with buildings');
  });

  test('cannot mortgage if another property in group has houses', () => {
    const state = createMockState();
    state.board.tiles['park-place'].ownerId = 'p1' as PlayerId;
    state.board.tiles['park-place'].houses = 1;
    expect(() => MortgagePlanner.planMortgageProperty(state, mockConfig, 'boardwalk' as TileId, 'p1' as PlayerId, 'act-1', 123))
      .toThrow('Cannot mortgage while buildings exist in the color group');
  });
});
