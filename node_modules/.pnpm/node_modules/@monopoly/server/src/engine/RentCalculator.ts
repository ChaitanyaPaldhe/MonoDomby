// =============================================================================
// engine/RentCalculator.ts
// Pure functions for calculating and applying rent.
// =============================================================================

import {
  DecisionType,
  EventType,
  GamePhase,
  TurnPhase,
} from '@monopoly/shared';
import type {
  GameState,
  MapConfig,
  Tile,
  PlayerId,
  TileId,
  ClientAction,
  RentCalculatedEvent,
  RentPaidEvent,
  MonopolyRentAppliedEvent,
  GameEvent,
} from '@monopoly/shared';
import type { EngineResult } from './types.js';
import { EngineStateCorruptionError } from './errors.js';

/**
 * Encapsulates rent logic for Properties, Railroads, and Utilities.
 */
export class RentCalculator {
  /**
   * Calculates and processes rent for a player landing on an owned property.
   *
   * @param state Current game state
   * @param tile The tile landed on (must be PROPERTY, RAILROAD, or UTILITY)
   * @param config Map configuration
   * @param action The originating action (for event IDs)
   * @param actingPlayerId The player who landed and owes rent
   * @returns EngineResult with either rent paid (POST_ROLL) or INSUFFICIENT_FUNDS
   */
  static processRent(
    state: GameState,
    tile: Tile,
    config: MapConfig,
    action: ClientAction,
    actingPlayerId: PlayerId,
  ): EngineResult {
    const tileId = tile.id as TileId;
    const tileState = state.board.tiles[tileId];

    if (!tileState) {
      throw new EngineStateCorruptionError(`Missing TileState for ${tileId}`);
    }

    const ownerId = tileState.ownerId;
    if (!ownerId) {
      throw new EngineStateCorruptionError(`Cannot process rent for unowned tile ${tileId}`);
    }

    const owner = state.players[ownerId];
    if (!owner) {
      throw new EngineStateCorruptionError(`Missing owner player ${ownerId}`);
    }

    // Validation: Owner cannot pay themselves
    if (ownerId === actingPlayerId) {
      throw new EngineStateCorruptionError(`Player ${actingPlayerId} cannot pay rent to themselves`);
    }

    // Validation: Mortgaged properties collect no rent
    if (tileState.isMortgaged) {
      return {
        newState: this.toPostRoll(state),
        events: [],
      };
    }

    // Validation: Bankrupt players cannot collect rent
    if (owner.isBankrupt) {
      return {
        newState: this.toPostRoll(state),
        events: [],
      };
    }

    const actingPlayer = state.players[actingPlayerId];
    if (!actingPlayer) {
      throw new EngineStateCorruptionError(`Missing acting player ${actingPlayerId}`);
    }

    let rentAmount = 0;
    let isMonopolyRent = false;
    let baseAmount = 0;

    if (tile.type === 'PROPERTY' && tile.propertyData) {
      if (tileState.hasHotel) {
        rentAmount = tile.propertyData.rents.hotel;
      } else if (tileState.houses > 0) {
        rentAmount = tile.propertyData.rents.houses[tileState.houses - 1] ?? 0;
      } else {
        baseAmount = tile.propertyData.rents.base;
        rentAmount = baseAmount;

        // Check monopoly
        const colorGroup = config.board.tiles.filter(
          t => t.type === 'PROPERTY' && t.propertyData?.groupId === tile.propertyData!.groupId
        );
        const ownsAll = colorGroup.every(t => state.board.tiles[t.id as TileId]?.ownerId === ownerId);

        if (ownsAll) {
          rentAmount = baseAmount * 2;
          isMonopolyRent = true;
        }
      }
    } else if (tile.type === 'RAILROAD' && tile.railroadData) {
      const railroads = config.board.tiles.filter(t => t.type === 'RAILROAD');
      const ownedCount = railroads.filter(t => state.board.tiles[t.id as TileId]?.ownerId === ownerId).length;
      rentAmount = tile.railroadData.rents[ownedCount - 1] ?? 0;
    } else if (tile.type === 'UTILITY' && tile.utilityData) {
      const dice = state.turn.diceValues;
      if (!dice) {
        throw new EngineStateCorruptionError('Cannot compute utility rent without dice roll');
      }
      const totalRoll = dice[0] + dice[1];

      const utilities = config.board.tiles.filter(t => t.type === 'UTILITY');
      const ownedCount = utilities.filter(t => state.board.tiles[t.id as TileId]?.ownerId === ownerId).length;
      const multiplier = tile.utilityData.diceMultipliers[ownedCount - 1] ?? 0;

      rentAmount = totalRoll * multiplier;
    } else {
      throw new EngineStateCorruptionError(`Tile ${tileId} does not collect rent`);
    }

    // No rent due (e.g. rent is 0)
    if (rentAmount <= 0) {
      return {
        newState: this.toPostRoll(state),
        events: [],
      };
    }

    const events: GameEvent[] = [];

    // Emit RENT_CALCULATED
    events.push({
      id: `${action.actionId}::RENT_CALCULATED`,
      type: EventType.RENT_CALCULATED,
      roomId: state.roomId as unknown as string,
      gameId: state.id as unknown as string,
      ts: action.clientTs,
      audience: { type: 'ALL' },
      payload: {
        payerId: actingPlayerId,
        payeeId: ownerId,
        tileId,
        amount: rentAmount,
      },
    });

    if (isMonopolyRent && tile.type === 'PROPERTY') {
      events.push({
        id: `${action.actionId}::MONOPOLY_RENT_APPLIED`,
        type: EventType.MONOPOLY_RENT_APPLIED,
        roomId: state.roomId as unknown as string,
        gameId: state.id as unknown as string,
        ts: action.clientTs,
        audience: { type: 'ALL' },
        payload: {
          payerId: actingPlayerId,
          payeeId: ownerId,
          tileId,
          groupId: tile.propertyData!.groupId,
          baseAmount,
          newAmount: rentAmount,
        },
      });
    }

    if (actingPlayer.money < rentAmount) {
      // INSUFFICIENT_FUNDS
      // Do not deduct yet. Preserve debt.
      const newState: GameState = {
        ...state,
        turn: {
          ...state.turn,
          pendingDecision: {
            type: DecisionType.INSUFFICIENT_FUNDS,
            creditorId: ownerId,
            amountOwed: rentAmount,
          },
        },
      };

      // Ensure we push an INSUFFICIENT_FUNDS event if required by architecture
      // Wait, is INSUFFICIENT_FUNDS an event in our GameEvent union? Yes.
      events.push({
        id: `${action.actionId}::INSUFFICIENT_FUNDS`,
        type: EventType.INSUFFICIENT_FUNDS,
        roomId: state.roomId as unknown as string,
        gameId: state.id as unknown as string,
        ts: action.clientTs,
        audience: { type: 'ALL' },
        payload: {
          playerId: actingPlayerId,
          creditorId: ownerId,
          amountOwed: rentAmount,
        },
      });

      return { newState, events };
    }

    // Deduct and Transfer
    const newState: GameState = {
      ...state,
      players: {
        ...state.players,
        [actingPlayerId]: {
          ...actingPlayer,
          money: actingPlayer.money - rentAmount,
        },
        [ownerId]: {
          ...owner,
          money: owner.money + rentAmount,
        },
      },
    };

    const finalState = this.toPostRoll(newState);

    events.push({
      id: `${action.actionId}::RENT_PAID`,
      type: EventType.RENT_PAID,
      roomId: state.roomId as unknown as string,
      gameId: state.id as unknown as string,
      ts: action.clientTs,
      audience: { type: 'ALL' },
      payload: {
        payerId: actingPlayerId,
        payeeId: ownerId,
        tileId,
        amount: rentAmount,
      },
    });

    return { newState: finalState, events };
  }

  private static toPostRoll(state: GameState): GameState {
    return {
      ...state,
      turn: {
        ...state.turn,
        phase: TurnPhase.POST_ROLL,
        pendingDecision: null,
      },
    };
  }
}
