import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/GameEngine.js';
import { BankruptcyEngine } from '../src/BankruptcyEngine.js';
import { BankruptcyPlanner } from '../src/BankruptcyPlanner.js';
import { DebtResolutionEngine } from '../src/DebtResolutionEngine.js';
import { ActionProcessor } from '../src/ActionProcessor.js';
import { MapConfig } from '@monopoly/maps';
import { GameState, PlayerId, DecisionType, EventType, ActionType, TileType, WinCondition } from '@monopoly/shared';;

function createSimulationMap(): MapConfig {
  return {
    schemaVersion: '1.0',
    meta: { id: 'test-map', name: 'Test Map', playerTokens: [] },
    bank: { startingMoney: 1500, infiniteMoney: true, initialHouses: 32, initialHotels: 12, goReward: 200 },
    board: {
      size: 5, jailTileIndex: 1,
      tiles: [
        { id: 'go', index: 0, type: TileType.GO, name: 'GO' },
        { id: 'baltic_avenue', index: 1, type: TileType.PROPERTY, name: 'Baltic Avenue', propertyData: { price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50, colorGroup: 'brown', mortgageValue: 30 } },
      ],
      colorGroups: [{ id: 'brown', name: 'Brown', tileIds: ['baltic_avenue'] }]
    },
    cards: { chance: [], communityChest: [] }, cardDecks: { chance: [], communityChest: [] },
    rules: { allowAuctions: true, allowTrading: true, evenBuilding: true, auctionConfig: { durationSeconds: 30 }, mortgageInterestRate: 0.1, mortgagedPropertyValuation: 0.5, winCondition: WinCondition.LAST_STANDING, jailFine: 50, maxJailRolls: 3, doublesToJail: 3 }
  };
}

describe('Bankruptcy Engine', () => {
  const mapConfig = createSimulationMap();
  const processor = new ActionProcessor();

  const getInitialState = (): GameState => {
    return GameEngine.createInitialState({
      roomId: 'test-room',
      gameId: 'test-game',
      mapConfig,
      players: [
        { userId: 'u1', playerId: 'p1' as PlayerId, displayName: 'P1', avatarUrl: '', tokenId: 't1' },
        { userId: 'u2', playerId: 'p2' as PlayerId, displayName: 'P2', avatarUrl: '', tokenId: 't2' }
      ],
      settingsOverrides: {},
      rngSeed: 'test',
      createdAt: 1000
    }).newState;
  };

  it('declares bankruptcy to bank when owed to bank', () => {
    const state = getInitialState();
    state.players['p1'].money = 50;
    state.turn.currentPlayerId = 'p1' as PlayerId;
    state.turn.pendingDecision = {
      type: DecisionType.DEBT_RECOVERY,
      creditorId: null, // Owed to bank
      amountOwed: 500
    };

    // p1 owns a property
    state.board.tiles['baltic_avenue'].ownerId = 'p1' as PlayerId;
    state.players['p1'].properties.push('baltic_avenue');
    state.players['p1'].getOutOfJailCards = 1;

    const plan = BankruptcyPlanner.planBankruptcy(state, mapConfig, 'p1' as PlayerId, 'action1', 1000);
    const { newState, events } = BankruptcyEngine.executeBankruptcyPlan(state, plan, mapConfig, 'action1', 1000);

    expect(newState.players['p1'].isBankrupt).toBe(true);
    expect(newState.players['p1'].money).toBe(0);
    expect(newState.players['p1'].properties.length).toBe(0);
    expect(newState.players['p1'].getOutOfJailCards).toBe(0);

    // Property returns to bank
    expect(newState.board.tiles['baltic_avenue'].ownerId).toBe(null);
    expect(newState.turn.pendingDecision).toBe(null);

    // Initial bank money was finite
    const oldBankMoney = state.bank.money;
    expect(newState.bank.money).toBe(oldBankMoney + 50);

    expect(events.some(e => e.type === EventType.BANKRUPTCY_STARTED)).toBe(true);
    expect(events.some(e => e.type === EventType.PLAYER_ELIMINATED)).toBe(true);
    expect(events.some(e => e.type === EventType.PROPERTY_RETURNED_TO_BANK)).toBe(true);
  });

  it('declares bankruptcy to player when owed to player', () => {
    const state = getInitialState();
    state.players['p1'].money = 50;
    state.turn.currentPlayerId = 'p1' as PlayerId;
    state.turn.pendingDecision = {
      type: DecisionType.DEBT_RECOVERY,
      creditorId: 'p2' as PlayerId,
      amountOwed: 500
    };

    state.board.tiles['baltic_avenue'].ownerId = 'p1' as PlayerId;
    state.players['p1'].properties.push('baltic_avenue');

    const plan = BankruptcyPlanner.planBankruptcy(state, mapConfig, 'p1' as PlayerId, 'action2', 1000);
    const { newState, events } = BankruptcyEngine.executeBankruptcyPlan(state, plan, mapConfig, 'action2', 1000);

    expect(newState.players['p1'].isBankrupt).toBe(true);
    expect(newState.players['p1'].money).toBe(0);
    expect(newState.players['p2'].money).toBe(1500 + 50);
    expect(newState.players['p2'].properties).toContain('baltic_avenue');
    expect(newState.board.tiles['baltic_avenue'].ownerId).toBe('p2');

    expect(events.some(e => e.type === EventType.PROPERTY_TRANSFERRED)).toBe(true);
  });

  it('prevents bankruptcy if player has buildings', () => {
    const state = getInitialState();
    state.turn.currentPlayerId = 'p1' as PlayerId;
    state.turn.pendingDecision = {
      type: DecisionType.DEBT_RECOVERY,
      creditorId: 'p2' as PlayerId,
      amountOwed: 500
    };

    state.board.tiles['baltic_avenue'].ownerId = 'p1' as PlayerId;
    state.board.tiles['baltic_avenue'].houses = 1;
    state.players['p1'].properties.push('baltic_avenue');

    expect(() => {
      BankruptcyPlanner.planBankruptcy(state, mapConfig, 'p1' as PlayerId, 'action3', 1000);
    }).toThrow('You must sell all buildings before declaring bankruptcy.');
  });

  it('automatically settles debt if player raises enough cash', () => {
    const state = getInitialState();
    state.players['p1'].money = 500;
    state.turn.currentPlayerId = 'p1' as PlayerId;
    state.turn.pendingDecision = {
      type: DecisionType.DEBT_RECOVERY,
      creditorId: 'p2' as PlayerId,
      amountOwed: 500
    };

    const { newState, events } = DebtResolutionEngine.checkAndSettleDebt(state, mapConfig, 'action4', 1000);

    expect(newState.players['p1'].money).toBe(0);
    expect(newState.players['p2'].money).toBe(2000);
    expect(newState.turn.pendingDecision).toBeNull();
    expect(events.some(e => e.type === EventType.DEBT_SETTLED)).toBe(true);
  });
});
