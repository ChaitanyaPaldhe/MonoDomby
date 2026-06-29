"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeEvaluator = void 0;
class TradeEvaluator {
    /**
     * Extremely simple heuristic for evaluating a trade.
     * Bots accept a trade if the perceived value of what they receive is >= what they give.
     */
    static evaluateTrade(state, config, trade, evaluatorId) {
        const isInitiator = evaluatorId === trade.initiatorId;
        const receiving = isInitiator ? trade.request : trade.offer;
        const giving = isInitiator ? trade.offer : trade.request;
        const receivingValue = this.calculateOfferValue(receiving, config);
        const givingValue = this.calculateOfferValue(giving, config);
        // If it puts us into debt we can't immediately pay, reject it.
        // (A real bot might sell houses, but this is a simple heuristic).
        const player = state.players[evaluatorId];
        if (player && (player.money + receiving.money - giving.money < 0)) {
            return { shouldAccept: false, shouldCounter: false };
        }
        if (receivingValue >= givingValue) {
            return { shouldAccept: true, shouldCounter: false };
        }
        // Counter by asking for the difference in cash, if possible
        const diff = givingValue - receivingValue;
        if (diff > 0 && diff < 500) {
            const newRequest = {
                ...receiving,
                money: receiving.money + diff
            };
            return {
                shouldAccept: false,
                shouldCounter: true,
                counterOffer: giving,
                counterRequest: newRequest
            };
        }
        return { shouldAccept: false, shouldCounter: false };
    }
    static calculateOfferValue(offer, config) {
        let value = offer.money;
        value += offer.jailCards * 50; // Assume jail card is worth $50
        for (const tileId of offer.properties) {
            const tDef = config.board.tiles.find(t => t.id === tileId);
            if (tDef?.propertyData) {
                value += tDef.propertyData.price;
            }
            else if (tDef?.railroadData) {
                value += tDef.railroadData.price;
            }
            else if (tDef?.utilityData) {
                value += tDef.utilityData.price;
            }
        }
        return value;
    }
}
exports.TradeEvaluator = TradeEvaluator;
//# sourceMappingURL=TradeEvaluator.js.map