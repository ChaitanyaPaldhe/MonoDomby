import { DecisionType, ErrorCode } from '@monopoly/shared';
;
import { EngineValidationError } from './errors.js';
export class BankruptcyPlanner {
    static planBankruptcy(state, config, playerId, actionId, clientTs) {
        if (state.turn.currentPlayerId !== playerId) {
            throw new EngineValidationError('Not your turn', ErrorCode.E_NOT_YOUR_TURN);
        }
        if (state.turn.pendingDecision?.type !== DecisionType.DEBT_RECOVERY) {
            throw new EngineValidationError('No active debt recovery phase', ErrorCode.E_INVALID_PHASE);
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
            throw new EngineValidationError('You must sell all buildings before declaring bankruptcy.', ErrorCode.E_INVALID_ACTION);
        }
        if (maxRaiseable >= decision.amountOwed) {
            throw new EngineValidationError('You have enough assets to settle this debt. Mortgage properties to raise cash.', ErrorCode.E_INVALID_ACTION);
        }
        return {
            playerId,
            creditorId: decision.creditorId
        };
    }
}
//# sourceMappingURL=BankruptcyPlanner.js.map