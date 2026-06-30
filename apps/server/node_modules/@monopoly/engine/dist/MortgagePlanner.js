import { EventType, ErrorCode } from '@monopoly/shared';
;
import { EngineValidationError } from './errors.js';
export class MortgagePlanner {
    static planMortgageProperty(state, config, tileId, playerId, actionId, clientTs) {
        const tileState = state.board.tiles[tileId];
        if (!tileState)
            throw new EngineValidationError('Tile does not exist', ErrorCode.E_INVALID_ACTION);
        if (tileState.ownerId !== playerId)
            throw new EngineValidationError('Player does not own this property', ErrorCode.E_PROPERTY_NOT_OWNED);
        if (tileState.isMortgaged)
            throw new EngineValidationError('Property is already mortgaged', ErrorCode.E_INVALID_ACTION);
        if (tileState.houses > 0 || tileState.hasHotel) {
            throw new EngineValidationError('Cannot mortgage property with buildings', ErrorCode.E_INVALID_ACTION);
        }
        const tileDef = config.board.tiles.find(t => t.id === tileId);
        if (!tileDef)
            throw new EngineValidationError('Tile definition not found', ErrorCode.E_INVALID_ACTION);
        // Check color group for buildings
        if (tileDef.propertyData) {
            const groupId = tileDef.propertyData.groupId;
            const groupTiles = config.board.tiles.filter(t => t.propertyData?.groupId === groupId);
            for (const t of groupTiles) {
                const ts = state.board.tiles[t.id];
                if (ts && (ts.houses > 0 || ts.hasHotel)) {
                    throw new EngineValidationError('Cannot mortgage while buildings exist in the color group', ErrorCode.E_INVALID_ACTION);
                }
            }
        }
        const mortgageValue = tileDef.propertyData?.mortgageValue ?? tileDef.railroadData?.mortgageValue ?? tileDef.utilityData?.mortgageValue;
        if (mortgageValue === undefined) {
            throw new EngineValidationError('Tile cannot be mortgaged', ErrorCode.E_INVALID_ACTION);
        }
        return {
            tileId,
            isMortgaging: true,
            playerMoneyChange: mortgageValue,
            events: [{
                    eventId: `${actionId}-mortgage`,
                    type: EventType.PROPERTY_MORTGAGED,
                    timestamp: clientTs,
                    payload: { playerId, tileId }
                }]
        };
    }
    static planUnmortgageProperty(state, config, tileId, playerId, actionId, clientTs) {
        const tileState = state.board.tiles[tileId];
        if (!tileState)
            throw new EngineValidationError('Tile does not exist', ErrorCode.E_INVALID_ACTION);
        if (tileState.ownerId !== playerId)
            throw new EngineValidationError('Player does not own this property', ErrorCode.E_PROPERTY_NOT_OWNED);
        if (!tileState.isMortgaged)
            throw new EngineValidationError('Property is not mortgaged', ErrorCode.E_INVALID_ACTION);
        const tileDef = config.board.tiles.find(t => t.id === tileId);
        if (!tileDef)
            throw new EngineValidationError('Tile definition not found', ErrorCode.E_INVALID_ACTION);
        const unmortgageCost = tileDef.propertyData?.unmortgageCost ?? tileDef.railroadData?.unmortgageCost ?? tileDef.utilityData?.unmortgageCost;
        if (unmortgageCost === undefined) {
            throw new EngineValidationError('Tile cannot be unmortgaged', ErrorCode.E_INVALID_ACTION);
        }
        const player = state.players[playerId];
        if (player.money < unmortgageCost) {
            throw new EngineValidationError('Insufficient funds to unmortgage', ErrorCode.E_DEBT_RECOVERY);
        }
        return {
            tileId,
            isMortgaging: false,
            playerMoneyChange: -unmortgageCost,
            events: [{
                    eventId: `${actionId}-unmortgage`,
                    type: EventType.PROPERTY_UNMORTGAGED,
                    timestamp: clientTs,
                    payload: { playerId, tileId }
                }]
        };
    }
    static validatePlan(plan, state, config, playerId) {
        const ts = state.board.tiles[plan.tileId];
        if (!ts)
            throw new EngineValidationError('Tile does not exist', ErrorCode.E_INVALID_ACTION);
        if (ts.ownerId !== playerId)
            throw new EngineValidationError('Ownership mismatch', ErrorCode.E_PROPERTY_NOT_OWNED);
        if (plan.isMortgaging) {
            if (ts.isMortgaged)
                throw new EngineValidationError('Already mortgaged', ErrorCode.E_INVALID_ACTION);
            if (ts.houses > 0 || ts.hasHotel)
                throw new EngineValidationError('Buildings exist', ErrorCode.E_INVALID_ACTION);
        }
        else {
            if (!ts.isMortgaged)
                throw new EngineValidationError('Not mortgaged', ErrorCode.E_INVALID_ACTION);
            const player = state.players[playerId];
            if (player.money + plan.playerMoneyChange < 0) {
                throw new EngineValidationError('Insufficient funds', ErrorCode.E_DEBT_RECOVERY);
            }
        }
    }
}
//# sourceMappingURL=MortgagePlanner.js.map