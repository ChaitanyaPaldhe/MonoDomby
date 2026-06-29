import { MapConfig } from '@monopoly/maps';
import { GameState, TileId, PlayerId, ErrorCode, EventType, GameEvent, TileState } from '@monopoly/shared';;
import type { PropertyTransactionPlan } from './types.js';
import { EngineValidationError } from './errors.js';
import { createHash } from 'node:crypto';

export class PropertyTransactionPlanner {
  
  /**
   * Helper to determine if a group's building state is valid (even building).
   * '5' represents a hotel. Difference between max and min buildings cannot exceed 1.
   */
  private static isGroupEven(
    groupId: string,
    state: GameState,
    tileChanges: Record<TileId, TileState>,
    mapConfig: MapConfig
  ): boolean {
    const groupTiles = mapConfig.board.tiles.filter(t => t.propertyData?.groupId === groupId);
    if (groupTiles.length === 0) return true;

    let minBuildings = 5;
    let maxBuildings = 0;

    for (const t of groupTiles) {
      const tileState = tileChanges[t.id as TileId] ?? state.board.tiles[t.id as TileId];
      if (tileState?.isMortgaged) {
        // If any property in the group is mortgaged, you can't have ANY buildings on ANY property.
        // And if you're trying to validate even-building while a mortgage exists, we just enforce no buildings.
        minBuildings = 0;
      }
      
      const buildings = tileState?.hasHotel ? 5 : (tileState?.houses ?? 0);
      if (buildings < minBuildings) minBuildings = buildings;
      if (buildings > maxBuildings) maxBuildings = buildings;
    }

    if (maxBuildings > 0) {
      // If there are buildings, no property can be mortgaged
      for (const t of groupTiles) {
        const tileState = tileChanges[t.id as TileId] ?? state.board.tiles[t.id as TileId];
        if (tileState?.isMortgaged) return false;
      }
    }

    return (maxBuildings - minBuildings) <= 1;
  }

  /**
   * General validator for a planned transaction.
   * Ensures bank limits, player cash, and even building rules are respected.
   * Throws EngineValidationError if invalid.
   */
  public static validateTransaction(
    plan: PropertyTransactionPlan,
    state: GameState,
    mapConfig: MapConfig,
    playerId: PlayerId
  ): void {
    if (state.bank.houses + plan.bankHouseChange < 0) {
      throw new EngineValidationError('Insufficient houses in the bank.', ErrorCode.E_NO_HOUSES_AVAILABLE);
    }
    if (state.bank.hotels + plan.bankHotelChange < 0) {
      throw new EngineValidationError('Insufficient hotels in the bank.', ErrorCode.E_NO_HOTELS_AVAILABLE);
    }
    const player = state.players[playerId];
    if (player && player.money + plan.playerMoneyChange < 0) {
      throw new EngineValidationError('Insufficient funds.', ErrorCode.E_DEBT_RECOVERY);
    }

    // Verify even building for all affected groups
    const affectedGroups = new Set<string>();
    for (const tileId of Object.keys(plan.tileChanges)) {
      const tile = mapConfig.board.tiles.find(t => t.id === tileId);
      if (tile?.propertyData?.groupId) {
        affectedGroups.add(tile.propertyData.groupId);
      }
    }

    for (const groupId of affectedGroups) {
      if (!this.isGroupEven(groupId, state, plan.tileChanges, mapConfig)) {
        throw new EngineValidationError(`Even building rule violated for group ${groupId}.`, ErrorCode.E_INVALID_ACTION);
      }
    }
  }

  /**
   * Check if a player owns all properties in a color group.
   */
  private static ownsMonopoly(groupId: string, state: GameState, mapConfig: MapConfig, playerId: PlayerId): boolean {
    const groupTiles = mapConfig.board.tiles.filter(t => t.propertyData?.groupId === groupId);
    if (groupTiles.length === 0) return false;
    for (const t of groupTiles) {
      if (state.board.tiles[t.id as TileId]?.ownerId !== playerId) return false;
    }
    return true;
  }

  public static planBuildHouse(
    state: GameState,
    mapConfig: MapConfig,
    tileId: TileId,
    playerId: PlayerId,
    actionId: string,
    clientTs: number
  ): PropertyTransactionPlan {
    const tile = mapConfig.board.tiles.find(t => t.id === tileId);
    if (!tile || !tile.propertyData) {
      throw new EngineValidationError('Not a property tile.', ErrorCode.E_INVALID_ACTION);
    }
    const currentTileState = state.board.tiles[tileId];
    if (!currentTileState) throw new EngineValidationError('Tile state missing', ErrorCode.E_INVALID_ACTION);
    if (currentTileState.ownerId !== playerId) {
      throw new EngineValidationError('You do not own this property.', ErrorCode.E_INVALID_ACTION);
    }
    if (!this.ownsMonopoly(tile.propertyData.groupId, state, mapConfig, playerId)) {
      throw new EngineValidationError('You must own the entire color group to build.', ErrorCode.E_INVALID_ACTION);
    }

    if (currentTileState.hasHotel) {
      throw new EngineValidationError('Property already has a hotel.', ErrorCode.E_INVALID_ACTION);
    }
    if (currentTileState.houses >= 4) {
      throw new EngineValidationError('Must build a hotel instead.', ErrorCode.E_INVALID_ACTION);
    }
    if (currentTileState.isMortgaged) {
      throw new EngineValidationError('Property is mortgaged.', ErrorCode.E_INVALID_ACTION);
    }

    const event: GameEvent = {
      id: createHash('sha256').update(`${actionId}:build-house`).digest('hex'),
      type: EventType.HOUSE_BUILT,
      roomId: state.roomId,
      gameId: state.id,
      ts: clientTs,
      audience: { type: 'ALL' },
      payload: {
        playerId,
        tileId,
        totalHouses: currentTileState!.houses + 1
      }
    };

    const plan: PropertyTransactionPlan = {
      tileChanges: {
        [tileId]: { 
          ...currentTileState,
          houses: currentTileState!.houses + 1 
        } as import('@monopoly/shared').TileState
      },
      bankHouseChange: -1,
      bankHotelChange: 0,
      playerMoneyChange: -tile.propertyData!.houseCost,
      events: [event]
    };

    this.validateTransaction(plan, state, mapConfig, playerId);
    return plan;
  }

  public static planSellHouse(
    state: GameState,
    mapConfig: MapConfig,
    tileId: TileId,
    playerId: PlayerId,
    actionId: string,
    clientTs: number
  ): PropertyTransactionPlan {
    const tile = mapConfig.board.tiles.find(t => t.id === tileId);
    if (!tile || !tile.propertyData) {
      throw new EngineValidationError('Not a property tile.', ErrorCode.E_INVALID_ACTION);
    }
    const currentTileState = state.board.tiles[tileId];
    if (!currentTileState) throw new EngineValidationError('Tile state missing', ErrorCode.E_INVALID_ACTION);
    if (currentTileState.ownerId !== playerId) {
      throw new EngineValidationError('You do not own this property.', ErrorCode.E_INVALID_ACTION);
    }

    if (currentTileState.hasHotel) {
      throw new EngineValidationError('Property has a hotel. Must sell hotel first.', ErrorCode.E_INVALID_ACTION);
    }
    if (currentTileState.houses <= 0) {
      throw new EngineValidationError('Property has no houses to sell.', ErrorCode.E_INVALID_ACTION);
    }

    const event: GameEvent = {
      id: createHash('sha256').update(`${actionId}:sell-house`).digest('hex'),
      type: EventType.HOUSE_SOLD,
      roomId: state.roomId,
      gameId: state.id,
      ts: clientTs,
      audience: { type: 'ALL' },
      payload: {
        playerId,
        tileId,
        totalHouses: currentTileState!.houses - 1
      }
    };

    const plan: PropertyTransactionPlan = {
      tileChanges: {
        [tileId]: { 
          ...currentTileState,
          houses: currentTileState!.houses - 1 
        } as import('@monopoly/shared').TileState
      },
      bankHouseChange: 1,
      bankHotelChange: 0,
      playerMoneyChange: tile.propertyData!.houseCost / 2,
      events: [event]
    };

    this.validateTransaction(plan, state, mapConfig, playerId);
    return plan;
  }

  public static planBuildHotel(
    state: GameState,
    mapConfig: MapConfig,
    tileId: TileId,
    playerId: PlayerId,
    actionId: string,
    clientTs: number
  ): PropertyTransactionPlan {
    const tile = mapConfig.board.tiles.find(t => t.id === tileId);
    if (!tile || !tile.propertyData) {
      throw new EngineValidationError('Not a property tile.', ErrorCode.E_INVALID_ACTION);
    }
    const currentTileState = state.board.tiles[tileId];
    if (!currentTileState) throw new EngineValidationError('Tile state missing', ErrorCode.E_INVALID_ACTION);
    if (currentTileState.ownerId !== playerId) {
      throw new EngineValidationError('You do not own this property.', ErrorCode.E_INVALID_ACTION);
    }
    if (!this.ownsMonopoly(tile.propertyData.groupId, state, mapConfig, playerId)) {
      throw new EngineValidationError('You must own the entire color group to build.', ErrorCode.E_INVALID_ACTION);
    }

    if (currentTileState.hasHotel) {
      throw new EngineValidationError('Property already has a hotel.', ErrorCode.E_INVALID_ACTION);
    }
    if (currentTileState.houses < 4) {
      throw new EngineValidationError('Must have 4 houses to build a hotel.', ErrorCode.E_INVALID_ACTION);
    }

    const event: GameEvent = {
      id: createHash('sha256').update(`${actionId}:build-hotel`).digest('hex'),
      type: EventType.HOTEL_BUILT,
      roomId: state.roomId,
      gameId: state.id,
      ts: clientTs,
      audience: { type: 'ALL' },
      payload: {
        playerId,
        tileId
      }
    };

    const plan: PropertyTransactionPlan = {
      tileChanges: { 
        [tileId]: { 
          ...currentTileState,
          houses: 0, 
          hasHotel: true 
        } as import('@monopoly/shared').TileState
      },
      bankHouseChange: 4, 
      bankHotelChange: -1, 
      playerMoneyChange: -tile.propertyData!.hotelCost,
      events: [event]
    };

    this.validateTransaction(plan, state, mapConfig, playerId);
    return plan;
  }

  public static planSellHotel(
    state: GameState,
    mapConfig: MapConfig,
    tileId: TileId,
    playerId: PlayerId,
    actionId: string,
    clientTs: number
  ): PropertyTransactionPlan {
    const tile = mapConfig.board.tiles.find(t => t.id === tileId);
    if (!tile || !tile.propertyData) {
      throw new EngineValidationError('Not a property tile.', ErrorCode.E_INVALID_ACTION);
    }

    const currentTileState = state.board.tiles[tileId];
    if (!currentTileState) throw new EngineValidationError('Tile state missing', ErrorCode.E_INVALID_ACTION);
    if (currentTileState.ownerId !== playerId) {
      throw new EngineValidationError('Player does not own property.', ErrorCode.E_PROPERTY_NOT_OWNED);
    }
    if (!currentTileState!.hasHotel) {
      throw new EngineValidationError('Property does not have a hotel.', ErrorCode.E_INVALID_ACTION);
    }

    const groupId = tile.propertyData.groupId;
    
    // We start by assuming we just sell one hotel back for 4 houses.
    // If bank has enough houses, we are good.
    if (state.bank.houses >= 4) {
      const event: GameEvent = {
        id: createHash('sha256').update(`${actionId}:sell-hotel`).digest('hex'),
        type: EventType.HOTEL_SOLD,
        roomId: state.roomId,
        gameId: state.id,
        ts: clientTs,
        audience: { type: 'ALL' },
        payload: { playerId, tileId }
      };

      const plan: PropertyTransactionPlan = {
        tileChanges: {
          [tileId]: {
            ...currentTileState,
            houses: 4,
            hasHotel: false
          } as import('@monopoly/shared').TileState
        },
        bankHouseChange: -4,
        bankHotelChange: 1,
        playerMoneyChange: tile.propertyData!.hotelCost / 2,
        events: [event]
      };
      
      this.validateTransaction(plan, state, mapConfig, playerId);
      return plan;
    } else {
      const groupTiles = mapConfig.board.tiles.filter(t => t.propertyData?.groupId === groupId);
      
      let bankHouseChange = 0;
      let bankHotelChange = 0;
      let playerMoneyChange = 0;
      const tileChanges: Record<TileId, TileState> = {};
      const events: GameEvent[] = [];
      let eventCounter = 0;

      for (const groupTile of groupTiles) {
        const tId = groupTile.id as TileId;
        const ts = state.board.tiles[tId];
        if (!ts) continue;
        
        let moneyFromTile = 0;
        
        if (ts.hasHotel) {
          moneyFromTile += groupTile.propertyData!.hotelCost / 2;
          moneyFromTile += (groupTile.propertyData!.houseCost / 2) * 4;
          bankHotelChange += 1;
          
          events.push({
            id: createHash('sha256').update(`${actionId}:sell-hotel-shortage-${eventCounter++}`).digest('hex'),
            type: EventType.HOTEL_SOLD,
            roomId: state.roomId,
            gameId: state.id,
            ts: clientTs,
            audience: { type: 'ALL' },
            payload: { playerId, tileId: tId }
          });
          
          for(let i = 0; i < 4; i++) {
             events.push({
               id: createHash('sha256').update(`${actionId}:sell-house-shortage-${eventCounter++}`).digest('hex'),
               type: EventType.HOUSE_SOLD,
               roomId: state.roomId,
               gameId: state.id,
               ts: clientTs,
               audience: { type: 'ALL' },
               payload: { playerId, tileId: tId, totalHouses: 4 - (i + 1) }
             });
          }
        } else if (ts.houses > 0) {
          moneyFromTile += (groupTile.propertyData!.houseCost / 2) * ts.houses;
          bankHouseChange += ts.houses;
          
          for(let i = 0; i < ts.houses; i++) {
             events.push({
               id: createHash('sha256').update(`${actionId}:sell-house-shortage-${eventCounter++}`).digest('hex'),
               type: EventType.HOUSE_SOLD,
               roomId: state.roomId,
               gameId: state.id,
               ts: clientTs,
               audience: { type: 'ALL' },
               payload: { playerId, tileId: tId, totalHouses: ts.houses - (i + 1) }
             });
          }
        }

        playerMoneyChange += moneyFromTile;
        tileChanges[tId] = {
          ...ts,
          houses: 0,
          hasHotel: false
        } as import('@monopoly/shared').TileState;
      }

      events.push({
        id: createHash('sha256').update(`${actionId}:bank-shortage`).digest('hex'),
        type: EventType.BANK_SHORTAGE,
        roomId: state.roomId,
        gameId: state.id,
        ts: clientTs,
        audience: { type: 'ALL' as const },
        payload: {
          groupId,
          reason: 'Insufficient bank houses to downgrade hotel. Complete liquidation forced.'
        }
      });

      const plan: PropertyTransactionPlan = {
        tileChanges,
        bankHouseChange,
        bankHotelChange,
        playerMoneyChange,
        events
      };

      this.validateTransaction(plan, state, mapConfig, playerId);
      return plan;
    }
  }
}
