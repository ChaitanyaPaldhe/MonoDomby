"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertyTransactionPlanner = void 0;
const shared_1 = require("@monopoly/shared");
const errors_js_1 = require("./errors.js");
const node_crypto_1 = require("node:crypto");
class PropertyTransactionPlanner {
    /**
     * Helper to determine if a group's building state is valid (even building).
     * '5' represents a hotel. Difference between max and min buildings cannot exceed 1.
     */
    static isGroupEven(groupId, state, tileChanges, mapConfig) {
        const groupTiles = mapConfig.board.tiles.filter(t => t.propertyData?.groupId === groupId);
        if (groupTiles.length === 0)
            return true;
        let minBuildings = 5;
        let maxBuildings = 0;
        for (const t of groupTiles) {
            const tileState = tileChanges[t.id] ?? state.board.tiles[t.id];
            if (tileState?.isMortgaged) {
                // If any property in the group is mortgaged, you can't have ANY buildings on ANY property.
                // And if you're trying to validate even-building while a mortgage exists, we just enforce no buildings.
                minBuildings = 0;
            }
            const buildings = tileState?.hasHotel ? 5 : (tileState?.houses ?? 0);
            if (buildings < minBuildings)
                minBuildings = buildings;
            if (buildings > maxBuildings)
                maxBuildings = buildings;
        }
        if (maxBuildings > 0) {
            // If there are buildings, no property can be mortgaged
            for (const t of groupTiles) {
                const tileState = tileChanges[t.id] ?? state.board.tiles[t.id];
                if (tileState?.isMortgaged)
                    return false;
            }
        }
        return (maxBuildings - minBuildings) <= 1;
    }
    /**
     * General validator for a planned transaction.
     * Ensures bank limits, player cash, and even building rules are respected.
     * Throws EngineValidationError if invalid.
     */
    static validateTransaction(plan, state, mapConfig, playerId) {
        if (state.bank.houses + plan.bankHouseChange < 0) {
            throw new errors_js_1.EngineValidationError('Insufficient houses in the bank.', shared_1.ErrorCode.E_NO_HOUSES_AVAILABLE);
        }
        if (state.bank.hotels + plan.bankHotelChange < 0) {
            throw new errors_js_1.EngineValidationError('Insufficient hotels in the bank.', shared_1.ErrorCode.E_NO_HOTELS_AVAILABLE);
        }
        const player = state.players[playerId];
        if (player && player.money + plan.playerMoneyChange < 0) {
            throw new errors_js_1.EngineValidationError('Insufficient funds.', shared_1.ErrorCode.E_DEBT_RECOVERY);
        }
        // Verify even building for all affected groups
        const affectedGroups = new Set();
        for (const tileId of Object.keys(plan.tileChanges)) {
            const tile = mapConfig.board.tiles.find(t => t.id === tileId);
            if (tile?.propertyData?.groupId) {
                affectedGroups.add(tile.propertyData.groupId);
            }
        }
        for (const groupId of affectedGroups) {
            if (!this.isGroupEven(groupId, state, plan.tileChanges, mapConfig)) {
                throw new errors_js_1.EngineValidationError(`Even building rule violated for group ${groupId}.`, shared_1.ErrorCode.E_INVALID_ACTION);
            }
        }
    }
    /**
     * Check if a player owns all properties in a color group.
     */
    static ownsMonopoly(groupId, state, mapConfig, playerId) {
        const groupTiles = mapConfig.board.tiles.filter(t => t.propertyData?.groupId === groupId);
        if (groupTiles.length === 0)
            return false;
        for (const t of groupTiles) {
            if (state.board.tiles[t.id]?.ownerId !== playerId)
                return false;
        }
        return true;
    }
    static planBuildHouse(state, mapConfig, tileId, playerId, actionId, clientTs) {
        const tile = mapConfig.board.tiles.find(t => t.id === tileId);
        if (!tile || !tile.propertyData) {
            throw new errors_js_1.EngineValidationError('Not a property tile.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        const currentTileState = state.board.tiles[tileId];
        if (!currentTileState)
            throw new errors_js_1.EngineValidationError('Tile state missing', shared_1.ErrorCode.E_INVALID_ACTION);
        if (currentTileState.ownerId !== playerId) {
            throw new errors_js_1.EngineValidationError('You do not own this property.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        if (!this.ownsMonopoly(tile.propertyData.groupId, state, mapConfig, playerId)) {
            throw new errors_js_1.EngineValidationError('You must own the entire color group to build.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        if (currentTileState.hasHotel) {
            throw new errors_js_1.EngineValidationError('Property already has a hotel.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        if (currentTileState.houses >= 4) {
            throw new errors_js_1.EngineValidationError('Must build a hotel instead.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        if (currentTileState.isMortgaged) {
            throw new errors_js_1.EngineValidationError('Property is mortgaged.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        const event = {
            id: (0, node_crypto_1.createHash)('sha256').update(`${actionId}:build-house`).digest('hex'),
            type: shared_1.EventType.HOUSE_BUILT,
            roomId: state.roomId,
            gameId: state.id,
            ts: clientTs,
            audience: { type: 'ALL' },
            payload: {
                playerId,
                tileId,
                totalHouses: currentTileState.houses + 1
            }
        };
        const plan = {
            tileChanges: {
                [tileId]: {
                    ...currentTileState,
                    houses: currentTileState.houses + 1
                }
            },
            bankHouseChange: -1,
            bankHotelChange: 0,
            playerMoneyChange: -tile.propertyData.houseCost,
            events: [event]
        };
        this.validateTransaction(plan, state, mapConfig, playerId);
        return plan;
    }
    static planSellHouse(state, mapConfig, tileId, playerId, actionId, clientTs) {
        const tile = mapConfig.board.tiles.find(t => t.id === tileId);
        if (!tile || !tile.propertyData) {
            throw new errors_js_1.EngineValidationError('Not a property tile.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        const currentTileState = state.board.tiles[tileId];
        if (!currentTileState)
            throw new errors_js_1.EngineValidationError('Tile state missing', shared_1.ErrorCode.E_INVALID_ACTION);
        if (currentTileState.ownerId !== playerId) {
            throw new errors_js_1.EngineValidationError('You do not own this property.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        if (currentTileState.hasHotel) {
            throw new errors_js_1.EngineValidationError('Property has a hotel. Must sell hotel first.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        if (currentTileState.houses <= 0) {
            throw new errors_js_1.EngineValidationError('Property has no houses to sell.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        const event = {
            id: (0, node_crypto_1.createHash)('sha256').update(`${actionId}:sell-house`).digest('hex'),
            type: shared_1.EventType.HOUSE_SOLD,
            roomId: state.roomId,
            gameId: state.id,
            ts: clientTs,
            audience: { type: 'ALL' },
            payload: {
                playerId,
                tileId,
                totalHouses: currentTileState.houses - 1
            }
        };
        const plan = {
            tileChanges: {
                [tileId]: {
                    ...currentTileState,
                    houses: currentTileState.houses - 1
                }
            },
            bankHouseChange: 1,
            bankHotelChange: 0,
            playerMoneyChange: tile.propertyData.houseCost / 2,
            events: [event]
        };
        this.validateTransaction(plan, state, mapConfig, playerId);
        return plan;
    }
    static planBuildHotel(state, mapConfig, tileId, playerId, actionId, clientTs) {
        const tile = mapConfig.board.tiles.find(t => t.id === tileId);
        if (!tile || !tile.propertyData) {
            throw new errors_js_1.EngineValidationError('Not a property tile.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        const currentTileState = state.board.tiles[tileId];
        if (!currentTileState)
            throw new errors_js_1.EngineValidationError('Tile state missing', shared_1.ErrorCode.E_INVALID_ACTION);
        if (currentTileState.ownerId !== playerId) {
            throw new errors_js_1.EngineValidationError('You do not own this property.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        if (!this.ownsMonopoly(tile.propertyData.groupId, state, mapConfig, playerId)) {
            throw new errors_js_1.EngineValidationError('You must own the entire color group to build.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        if (currentTileState.hasHotel) {
            throw new errors_js_1.EngineValidationError('Property already has a hotel.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        if (currentTileState.houses < 4) {
            throw new errors_js_1.EngineValidationError('Must have 4 houses to build a hotel.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        const event = {
            id: (0, node_crypto_1.createHash)('sha256').update(`${actionId}:build-hotel`).digest('hex'),
            type: shared_1.EventType.HOTEL_BUILT,
            roomId: state.roomId,
            gameId: state.id,
            ts: clientTs,
            audience: { type: 'ALL' },
            payload: {
                playerId,
                tileId
            }
        };
        const plan = {
            tileChanges: {
                [tileId]: {
                    ...currentTileState,
                    houses: 0,
                    hasHotel: true
                }
            },
            bankHouseChange: 4,
            bankHotelChange: -1,
            playerMoneyChange: -tile.propertyData.hotelCost,
            events: [event]
        };
        this.validateTransaction(plan, state, mapConfig, playerId);
        return plan;
    }
    static planSellHotel(state, mapConfig, tileId, playerId, actionId, clientTs) {
        const tile = mapConfig.board.tiles.find(t => t.id === tileId);
        if (!tile || !tile.propertyData) {
            throw new errors_js_1.EngineValidationError('Not a property tile.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        const currentTileState = state.board.tiles[tileId];
        if (!currentTileState)
            throw new errors_js_1.EngineValidationError('Tile state missing', shared_1.ErrorCode.E_INVALID_ACTION);
        if (currentTileState.ownerId !== playerId) {
            throw new errors_js_1.EngineValidationError('Player does not own property.', shared_1.ErrorCode.E_PROPERTY_NOT_OWNED);
        }
        if (!currentTileState.hasHotel) {
            throw new errors_js_1.EngineValidationError('Property does not have a hotel.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        const groupId = tile.propertyData.groupId;
        // We start by assuming we just sell one hotel back for 4 houses.
        // If bank has enough houses, we are good.
        if (state.bank.houses >= 4) {
            const event = {
                id: (0, node_crypto_1.createHash)('sha256').update(`${actionId}:sell-hotel`).digest('hex'),
                type: shared_1.EventType.HOTEL_SOLD,
                roomId: state.roomId,
                gameId: state.id,
                ts: clientTs,
                audience: { type: 'ALL' },
                payload: { playerId, tileId }
            };
            const plan = {
                tileChanges: {
                    [tileId]: {
                        ...currentTileState,
                        houses: 4,
                        hasHotel: false
                    }
                },
                bankHouseChange: -4,
                bankHotelChange: 1,
                playerMoneyChange: tile.propertyData.hotelCost / 2,
                events: [event]
            };
            this.validateTransaction(plan, state, mapConfig, playerId);
            return plan;
        }
        else {
            const groupTiles = mapConfig.board.tiles.filter(t => t.propertyData?.groupId === groupId);
            let bankHouseChange = 0;
            let bankHotelChange = 0;
            let playerMoneyChange = 0;
            const tileChanges = {};
            const events = [];
            let eventCounter = 0;
            for (const groupTile of groupTiles) {
                const tId = groupTile.id;
                const ts = state.board.tiles[tId];
                if (!ts)
                    continue;
                let moneyFromTile = 0;
                if (ts.hasHotel) {
                    moneyFromTile += groupTile.propertyData.hotelCost / 2;
                    moneyFromTile += (groupTile.propertyData.houseCost / 2) * 4;
                    bankHotelChange += 1;
                    events.push({
                        id: (0, node_crypto_1.createHash)('sha256').update(`${actionId}:sell-hotel-shortage-${eventCounter++}`).digest('hex'),
                        type: shared_1.EventType.HOTEL_SOLD,
                        roomId: state.roomId,
                        gameId: state.id,
                        ts: clientTs,
                        audience: { type: 'ALL' },
                        payload: { playerId, tileId: tId }
                    });
                    for (let i = 0; i < 4; i++) {
                        events.push({
                            id: (0, node_crypto_1.createHash)('sha256').update(`${actionId}:sell-house-shortage-${eventCounter++}`).digest('hex'),
                            type: shared_1.EventType.HOUSE_SOLD,
                            roomId: state.roomId,
                            gameId: state.id,
                            ts: clientTs,
                            audience: { type: 'ALL' },
                            payload: { playerId, tileId: tId, totalHouses: 4 - (i + 1) }
                        });
                    }
                }
                else if (ts.houses > 0) {
                    moneyFromTile += (groupTile.propertyData.houseCost / 2) * ts.houses;
                    bankHouseChange += ts.houses;
                    for (let i = 0; i < ts.houses; i++) {
                        events.push({
                            id: (0, node_crypto_1.createHash)('sha256').update(`${actionId}:sell-house-shortage-${eventCounter++}`).digest('hex'),
                            type: shared_1.EventType.HOUSE_SOLD,
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
                };
            }
            events.push({
                id: (0, node_crypto_1.createHash)('sha256').update(`${actionId}:bank-shortage`).digest('hex'),
                type: shared_1.EventType.BANK_SHORTAGE,
                roomId: state.roomId,
                gameId: state.id,
                ts: clientTs,
                audience: { type: 'ALL' },
                payload: {
                    groupId,
                    reason: 'Insufficient bank houses to downgrade hotel. Complete liquidation forced.'
                }
            });
            const plan = {
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
exports.PropertyTransactionPlanner = PropertyTransactionPlanner;
//# sourceMappingURL=PropertyTransactionPlanner.js.map