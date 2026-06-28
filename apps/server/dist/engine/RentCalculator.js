"use strict";
// =============================================================================
// engine/RentCalculator.ts
// Pure functions for calculating and applying rent.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.RentCalculator = void 0;
const shared_1 = require("@monopoly/shared");
const errors_js_1 = require("./errors.js");
/**
 * Encapsulates rent logic for Properties, Railroads, and Utilities.
 */
class RentCalculator {
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
    static processRent(state, tile, config, action, actingPlayerId) {
        const tileId = tile.id;
        const tileState = state.board.tiles[tileId];
        if (!tileState) {
            throw new errors_js_1.EngineStateCorruptionError(`Missing TileState for ${tileId}`);
        }
        const ownerId = tileState.ownerId;
        if (!ownerId) {
            throw new errors_js_1.EngineStateCorruptionError(`Cannot process rent for unowned tile ${tileId}`);
        }
        const owner = state.players[ownerId];
        if (!owner) {
            throw new errors_js_1.EngineStateCorruptionError(`Missing owner player ${ownerId}`);
        }
        // Validation: Owner cannot pay themselves
        if (ownerId === actingPlayerId) {
            throw new errors_js_1.EngineStateCorruptionError(`Player ${actingPlayerId} cannot pay rent to themselves`);
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
            throw new errors_js_1.EngineStateCorruptionError(`Missing acting player ${actingPlayerId}`);
        }
        let rentAmount = 0;
        let isMonopolyRent = false;
        let baseAmount = 0;
        if (tile.type === 'PROPERTY' && tile.propertyData) {
            if (tileState.hasHotel) {
                rentAmount = tile.propertyData.rents.hotel;
            }
            else if (tileState.houses > 0) {
                const rents = tile.propertyData.rents;
                switch (tileState.houses) {
                    case 1:
                        rentAmount = rents.oneHouse;
                        break;
                    case 2:
                        rentAmount = rents.twoHouses;
                        break;
                    case 3:
                        rentAmount = rents.threeHouses;
                        break;
                    case 4:
                        rentAmount = rents.fourHouses;
                        break;
                }
            }
            else {
                baseAmount = tile.propertyData.rents.base;
                rentAmount = baseAmount;
                // Check monopoly
                const colorGroup = config.board.tiles.filter(t => t.type === 'PROPERTY' && t.propertyData?.groupId === tile.propertyData.groupId);
                const ownsAll = colorGroup.every(t => state.board.tiles[t.id]?.ownerId === ownerId);
                if (ownsAll) {
                    rentAmount = baseAmount * 2;
                    isMonopolyRent = true;
                }
            }
        }
        else if (tile.type === 'RAILROAD' && tile.railroadData) {
            const railroads = config.board.tiles.filter(t => t.type === 'RAILROAD');
            const ownedCount = railroads.filter(t => state.board.tiles[t.id]?.ownerId === ownerId).length;
            rentAmount = tile.railroadData.rents[ownedCount - 1] ?? 0;
        }
        else if (tile.type === 'UTILITY' && tile.utilityData) {
            const dice = state.turn.diceValues;
            if (!dice) {
                throw new errors_js_1.EngineStateCorruptionError('Cannot compute utility rent without dice roll');
            }
            const totalRoll = dice[0] + dice[1];
            const utilities = config.board.tiles.filter(t => t.type === 'UTILITY');
            const ownedCount = utilities.filter(t => state.board.tiles[t.id]?.ownerId === ownerId).length;
            const multiplier = tile.utilityData.diceMultipliers[ownedCount - 1] ?? 0;
            rentAmount = totalRoll * multiplier;
        }
        else {
            throw new errors_js_1.EngineStateCorruptionError(`Tile ${tileId} does not collect rent`);
        }
        // No rent due (e.g. rent is 0)
        if (rentAmount <= 0) {
            return {
                newState: this.toPostRoll(state),
                events: [],
            };
        }
        const events = [];
        // Emit RENT_CALCULATED
        events.push({
            id: `${action.actionId}::RENT_CALCULATED`,
            type: shared_1.EventType.RENT_CALCULATED,
            roomId: state.roomId,
            gameId: state.id,
            ts: action.clientTs,
            audience: { type: 'ALL' },
            payload: {
                payerId: actingPlayerId,
                payeeId: ownerId,
                tileId,
                amount: rentAmount,
            },
        });
        // Removed MONOPOLY_RENT_APPLIED event as it does not exist in EventType
        if (actingPlayer.money < rentAmount) {
            // INSUFFICIENT_FUNDS
            // Do not deduct yet. Preserve debt.
            const newState = {
                ...state,
                turn: {
                    ...state.turn,
                    pendingDecision: {
                        type: shared_1.DecisionType.DEBT_RECOVERY,
                        creditorId: ownerId,
                        amountOwed: rentAmount,
                    },
                },
            };
            // Ensure we push an INSUFFICIENT_FUNDS event if required by architecture
            // Wait, is INSUFFICIENT_FUNDS an event in our GameEvent union? Yes.
            events.push({
                id: `${action.actionId}::INSUFFICIENT_FUNDS`,
                type: shared_1.EventType.DEBT_RECOVERY_STARTED,
                roomId: state.roomId,
                gameId: state.id,
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
        const newState = {
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
            type: shared_1.EventType.RENT_PAID,
            roomId: state.roomId,
            gameId: state.id,
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
    static toPostRoll(state) {
        return {
            ...state,
            turn: {
                ...state.turn,
                phase: shared_1.TurnPhase.POST_ROLL,
                pendingDecision: null,
            },
        };
    }
}
exports.RentCalculator = RentCalculator;
//# sourceMappingURL=RentCalculator.js.map