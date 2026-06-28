"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankruptcyPlanner = void 0;
const shared_1 = require("@monopoly/shared");
const errors_js_1 = require("./errors.js");
class BankruptcyPlanner {
    static planBankruptcy(state, config, playerId, actionId, clientTs) {
        if (state.turn.currentPlayerId !== playerId) {
            throw new errors_js_1.EngineValidationError('Not your turn', shared_1.ErrorCode.E_NOT_YOUR_TURN);
        }
        if (state.turn.pendingDecision?.type !== shared_1.DecisionType.DEBT_RECOVERY) {
            throw new errors_js_1.EngineValidationError('No active debt recovery phase', shared_1.ErrorCode.E_INVALID_PHASE);
        }
        const decision = state.turn.pendingDecision;
        const player = state.players[playerId];
        // 1. Check for buildings
        let hasBuildings = false;
        let maxRaiseable = player.money;
        for (const tId of player.properties) {
            const tile = state.board.tiles[tId];
            if (tile?.houses && tile.houses > 0)
                hasBuildings = true;
            if (tile?.hasHotel)
                hasBuildings = true;
            if (tile && !tile.isMortgaged) {
                const tDef = config.board.tiles.find(t => t.id === tId);
                if (tDef?.propertyData?.mortgageValue) {
                    maxRaiseable += tDef.propertyData.mortgageValue;
                }
                else if (tDef?.railroadData?.mortgageValue) {
                    maxRaiseable += tDef.railroadData.mortgageValue;
                }
                else if (tDef?.utilityData?.mortgageValue) {
                    maxRaiseable += tDef.utilityData.mortgageValue;
                }
            }
        }
        if (hasBuildings) {
            throw new errors_js_1.EngineValidationError('You must sell all buildings before declaring bankruptcy.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        if (maxRaiseable >= decision.amountOwed) {
            throw new errors_js_1.EngineValidationError('You have enough assets to settle this debt. Mortgage properties to raise cash.', shared_1.ErrorCode.E_INVALID_ACTION);
        }
        return {
            playerId,
            creditorId: decision.creditorId
        };
    }
}
exports.BankruptcyPlanner = BankruptcyPlanner;
//# sourceMappingURL=BankruptcyPlanner.js.map