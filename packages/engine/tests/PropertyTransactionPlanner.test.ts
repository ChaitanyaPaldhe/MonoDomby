import { describe, it, expect, beforeEach } from 'vitest';
import { PropertyTransactionPlanner } from '../src/PropertyTransactionPlanner.js';
import { PropertyManagementEngine } from '../src/PropertyManagementEngine.js';
import { MapConfig } from '@monopoly/maps';
import { GameState, GamePhase, TurnPhase, ErrorCode, EventType } from '@monopoly/shared';;
import { EngineValidationError } from '../src/errors.js';

describe('PropertyTransactionPlanner & PropertyManagementEngine', () => {
  let mockState: GameState;
  let mockMapConfig: MapConfig;

  beforeEach(() => {
    mockMapConfig = {
      board: {
        tiles: [
          { id: 'go', type: 'GO', position: 0 },
          { id: 't1', type: 'PROPERTY', position: 1, propertyData: { groupId: 'g1', houseCost: 50, hotelCost: 50, price: 100, mortgageValue: 50, rent: [], name: 'T1' } },
          { id: 't2', type: 'PROPERTY', position: 2, propertyData: { groupId: 'g1', houseCost: 50, hotelCost: 50, price: 100, mortgageValue: 50, rent: [], name: 'T2' } },
        ]
      },
      rules: {
        houses: { totalSupply: 32 },
        hotels: { totalSupply: 12 }
      }
    } as any;

    mockState = {
      id: 'game1',
      roomId: 'room1',
      phase: GamePhase.IN_PROGRESS,
      version: 1,
      createdAt: Date.now(),
      turn: {
        currentPlayerId: 'p1',
        phase: TurnPhase.PRE_ROLL,
        pendingDecision: null,
        consecutiveDoubles: 0,
        turnNumber: 1,
        startTime: Date.now()
      },
      bank: {
        infiniteMoney: true,
        money: 0,
        houses: 32,
        hotels: 12,
        properties: []
      },
      players: {
        p1: {
          id: 'p1',
          money: 1500,
          netWorth: 1500,
          properties: ['t1', 't2'],
          position: 0,
          isBankrupt: false,
          jailState: null,
          inventory: {}
        }
      },
      board: {
        tiles: {
          t1: { ownerId: 'p1', isMortgaged: false, houses: 0, hasHotel: false, currentRentMultiplier: 1 },
          t2: { ownerId: 'p1', isMortgaged: false, houses: 0, hasHotel: false, currentRentMultiplier: 1 }
        }
      },
      events: []
    } as any;
  });

  describe('planBuildHouse', () => {
    it('allows building a house when rules are met', () => {
      const plan = PropertyTransactionPlanner.planBuildHouse(mockState, mockMapConfig, 't1', 'p1', 'action1', 0);
      
      expect(plan.bankHouseChange).toBe(-1);
      expect(plan.playerMoneyChange).toBe(-50);
      expect(plan.tileChanges['t1'].houses).toBe(1);
    });

    it('rejects building if it violates even-building rule', () => {
      // Build first house on t1
      const plan = PropertyTransactionPlanner.planBuildHouse(mockState, mockMapConfig, 't1', 'p1', 'action1', 0);
      const { newState } = PropertyManagementEngine.applyTransaction(mockState, plan, mockMapConfig, 'p1');
      
      // Try to build second house on t1 while t2 has 0
      expect(() => {
        PropertyTransactionPlanner.planBuildHouse(newState, mockMapConfig, 't1', 'p1', 'action2', 0);
      }).toThrowError(EngineValidationError);
    });

    it('allows building second house if group is even', () => {
      let plan = PropertyTransactionPlanner.planBuildHouse(mockState, mockMapConfig, 't1', 'p1', 'a1', 0);
      const { newState } = PropertyManagementEngine.applyTransaction(mockState, plan, mockMapConfig, 'p1');
      
      plan = PropertyTransactionPlanner.planBuildHouse(newState, mockMapConfig, 't2', 'p1', 'a2', 0);
      const { newState: state2 } = PropertyManagementEngine.applyTransaction(newState, plan, mockMapConfig, 'p1');
      
      // Both have 1 house now. Can build second on t1.
      plan = PropertyTransactionPlanner.planBuildHouse(state2, mockMapConfig, 't1', 'p1', 'a3', 0);
      expect(plan.tileChanges['t1'].houses).toBe(2);
    });

    it('rejects if property is mortgaged', () => {
      mockState.board.tiles['t1'].isMortgaged = true;
      expect(() => {
        PropertyTransactionPlanner.planBuildHouse(mockState, mockMapConfig, 't2', 'p1', 'a', 0);
      }).toThrowError('Even building rule violated'); // Actually because one is mortgaged, max houses is 0.
    });

    it('rejects if insufficient money', () => {
      mockState.players['p1'].money = 0;
      expect(() => {
        PropertyTransactionPlanner.planBuildHouse(mockState, mockMapConfig, 't1', 'p1', 'a', 0);
      }).toThrowError('Insufficient funds');
    });

    it('rejects if bank has no houses', () => {
      mockState.bank.houses = 0;
      expect(() => {
        PropertyTransactionPlanner.planBuildHouse(mockState, mockMapConfig, 't1', 'p1', 'a', 0);
      }).toThrowError('Insufficient houses in the bank');
    });
  });

  describe('planBuildHotel', () => {
    it('allows building a hotel if properties have 4 houses', () => {
      mockState.board.tiles['t1'].houses = 4;
      mockState.board.tiles['t2'].houses = 4;

      const plan = PropertyTransactionPlanner.planBuildHotel(mockState, mockMapConfig, 't1', 'p1', 'a', 0);
      expect(plan.bankHouseChange).toBe(4); // 4 houses returned
      expect(plan.bankHotelChange).toBe(-1); // 1 hotel taken
      expect(plan.playerMoneyChange).toBe(-50);
      expect(plan.tileChanges['t1'].hasHotel).toBe(true);
      expect(plan.tileChanges['t1'].houses).toBe(0);
    });

    it('rejects building hotel if uneven', () => {
      mockState.board.tiles['t1'].houses = 4;
      mockState.board.tiles['t2'].houses = 3;

      expect(() => {
        PropertyTransactionPlanner.planBuildHotel(mockState, mockMapConfig, 't1', 'p1', 'a', 0);
      }).toThrowError('Even building rule violated');
    });
  });

  describe('planSellHotel with Bank Shortage', () => {
    beforeEach(() => {
      mockState.board.tiles['t1'].houses = 0;
      mockState.board.tiles['t1'].hasHotel = true;
      mockState.board.tiles['t2'].houses = 0;
      mockState.board.tiles['t2'].hasHotel = true;
    });

    it('downgrades to 4 houses if bank has sufficient houses', () => {
      const plan = PropertyTransactionPlanner.planSellHotel(mockState, mockMapConfig, 't1', 'p1', 'a', 0);
      expect(plan.bankHouseChange).toBe(-4);
      expect(plan.bankHotelChange).toBe(1);
      expect(plan.playerMoneyChange).toBe(25); // hotel cost 50 / 2
      expect(plan.tileChanges['t1'].houses).toBe(4);
      expect(plan.tileChanges['t1'].hasHotel).toBe(false);
      // t2 is untouched
      expect(plan.tileChanges['t2']).toBeUndefined();
    });

    it('forces complete liquidation if bank has shortage (<4 houses)', () => {
      mockState.bank.houses = 2; // Shortage!

      const plan = PropertyTransactionPlanner.planSellHotel(mockState, mockMapConfig, 't1', 'p1', 'a', 0);
      
      // Complete liquidation: 2 hotels sold, each hotel + 4 houses sold for cash
      // 1 hotel on T1 = 25 (hotel) + 4*25 (houses) = 125
      // 1 hotel on T2 = 25 + 100 = 125
      // Total money = 250
      expect(plan.playerMoneyChange).toBe(250);
      expect(plan.bankHotelChange).toBe(2);
      expect(plan.bankHouseChange).toBe(0);
      
      expect(plan.tileChanges['t1'].hasHotel).toBe(false);
      expect(plan.tileChanges['t1'].houses).toBe(0);
      
      expect(plan.tileChanges['t2'].hasHotel).toBe(false);
      expect(plan.tileChanges['t2'].houses).toBe(0);

      // Should emit a bank shortage event
      const shortageEvent = plan.events.find(e => e.type === EventType.BANK_SHORTAGE);
      expect(shortageEvent).toBeDefined();
    });
  });
  
  describe('calculateNetWorth', () => {
    it('correctly recalculates player net worth', () => {
       const plan = PropertyTransactionPlanner.planBuildHouse(mockState, mockMapConfig, 't1', 'p1', 'a1', 0);
       const { newState } = PropertyManagementEngine.applyTransaction(mockState, plan, mockMapConfig, 'p1');
       
       // Starting money: 1500
       // T1 mortgage value: 50, T2 mortgage value: 50
       // After building 1 house: money = 1450
       // T1 house worth = 25
       // Net worth = 1450 (cash) + 50 (T1) + 50 (T2) + 25 (T1 house) = 1575
       
       // Note: original networth was 1500 + 50 + 50 = 1600. After spending 50 on a house, 
       // cash drops by 50, asset drops by 25 (since house is worth half). So net worth drops by 25!
       expect(newState.players['p1'].netWorth).toBe(1575);
    });
  });
});
