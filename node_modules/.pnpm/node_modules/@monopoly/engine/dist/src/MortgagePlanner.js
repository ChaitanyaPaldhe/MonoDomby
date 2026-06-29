"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MortgagePlanner = void 0;
const shared_1 = require("@monopoly/shared");
;
const errors_js_1 = require("./errors.js");
class MortgagePlanner {
    static planMortgageProperty(state, config, tileId, playerId, actionId, clientTs) {
        const tileState = state.board.tiles[tileId];
        if (!tileState)
            throw new errors_js_1.EngineValidationError('Tile does not exist', shared_1.ErrorCode.E_INVALID_ACTION);
        if (tileState.ownerId !== playerId)
            throw new errors_js_1.EngineValidationError('Player does not own this property', shared_1.ErrorCode.E_PROPERTY_NOT_OWNED);
        if (tileState.isMortgaged)
            throw new errors_js_1.EngineValidationError('Property is already mortgaged', shared_1.ErrorCode.E_INVALID_ACTION);
        if (tileState.houses > 0 || tileState.hasHotel) {
            throw new errors_js_1.EngineValidationError('Cannot mortgage property with buildings', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        const tileDef = config.board.tiles.find(t => t.id === tileId);
        if (!tileDef)
            throw new errors_js_1.EngineValidationError('Tile definition not found', shared_1.ErrorCode.E_INVALID_ACTION);
        // Check color group for buildings
        if (tileDef.propertyData) {
            const groupId = tileDef.propertyData.groupId;
            const groupTiles = config.board.tiles.filter(t => t.propertyData?.groupId === groupId);
            for (const t of groupTiles) {
                const ts = state.board.tiles[t.id];
                if (ts && (ts.houses > 0 || ts.hasHotel)) {
                    throw new errors_js_1.EngineValidationError('Cannot mortgage while buildings exist in the color group', shared_1.ErrorCode.E_INVALID_ACTION);
                }
            }
        }
        const mortgageValue = tileDef.propertyData?.mortgageValue ?? tileDef.railroadData?.mortgageValue ?? tileDef.utilityData?.mortgageValue;
        if (mortgageValue === undefined) {
            throw new errors_js_1.EngineValidationError('Tile cannot be mortgaged', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        return {
            tileId,
            isMortgaging: true,
            playerMoneyChange: mortgageValue,
            events: [{
                    eventId: `${actionId}-mortgage`,
                    type: shared_1.EventType.PROPERTY_MORTGAGED,
                    timestamp: clientTs,
                    payload: { playerId, tileId }
                }]
        };
    }
    static planUnmortgageProperty(state, config, tileId, playerId, actionId, clientTs) {
        const tileState = state.board.tiles[tileId];
        if (!tileState)
            throw new errors_js_1.EngineValidationError('Tile does not exist', shared_1.ErrorCode.E_INVALID_ACTION);
        if (tileState.ownerId !== playerId)
            throw new errors_js_1.EngineValidationError('Player does not own this property', shared_1.ErrorCode.E_PROPERTY_NOT_OWNED);
        if (!tileState.isMortgaged)
            throw new errors_js_1.EngineValidationError('Property is not mortgaged', shared_1.ErrorCode.E_INVALID_ACTION);
        const tileDef = config.board.tiles.find(t => t.id === tileId);
        if (!tileDef)
            throw new errors_js_1.EngineValidationError('Tile definition not found', shared_1.ErrorCode.E_INVALID_ACTION);
        const unmortgageCost = tileDef.propertyData?.unmortgageCost ?? tileDef.railroadData?.unmortgageCost ?? tileDef.utilityData?.unmortgageCost;
        if (unmortgageCost === undefined) {
            throw new errors_js_1.EngineValidationError('Tile cannot be unmortgaged', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        const player = state.players[playerId];
        if (player.money < unmortgageCost) {
            throw new errors_js_1.EngineValidationError('Insufficient funds to unmortgage', shared_1.ErrorCode.E_DEBT_RECOVERY);
        }
        return {
            tileId,
            isMortgaging: false,
            playerMoneyChange: -unmortgageCost,
            events: [{
                    eventId: `${actionId}-unmortgage`,
                    type: shared_1.EventType.PROPERTY_UNMORTGAGED,
                    timestamp: clientTs,
                    payload: { playerId, tileId }
                }]
        };
    }
    static validatePlan(plan, state, config, playerId) {
        const ts = state.board.tiles[plan.tileId];
        if (!ts)
            throw new errors_js_1.EngineValidationError('Tile does not exist', shared_1.ErrorCode.E_INVALID_ACTION);
        if (ts.ownerId !== playerId)
            throw new errors_js_1.EngineValidationError('Ownership mismatch', shared_1.ErrorCode.E_PROPERTY_NOT_OWNED);
        if (plan.isMortgaging) {
            if (ts.isMortgaged)
                throw new errors_js_1.EngineValidationError('Already mortgaged', shared_1.ErrorCode.E_INVALID_ACTION);
            if (ts.houses > 0 || ts.hasHotel)
                throw new errors_js_1.EngineValidationError('Buildings exist', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        else {
            if (!ts.isMortgaged)
                throw new errors_js_1.EngineValidationError('Not mortgaged', shared_1.ErrorCode.E_INVALID_ACTION);
            const player = state.players[playerId];
            if (player.money + plan.playerMoneyChange < 0) {
                throw new errors_js_1.EngineValidationError('Insufficient funds', shared_1.ErrorCode.E_DEBT_RECOVERY);
            }
        }
    }
}
exports.MortgagePlanner = MortgagePlanner;
//# sourceMappingURL=MortgagePlanner.js.map