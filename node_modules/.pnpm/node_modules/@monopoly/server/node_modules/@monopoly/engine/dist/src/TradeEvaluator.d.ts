import type { MapConfig } from '@monopoly/maps';
export interface TradeEvaluationResult {
    readonly shouldAccept: boolean;
    readonly shouldCounter: boolean;
    readonly counterOffer?: TradeOffer;
    readonly counterRequest?: TradeOffer;
}
export declare class TradeEvaluator {
    /**
     * Extremely simple heuristic for evaluating a trade.
     * Bots accept a trade if the perceived value of what they receive is >= what they give.
     */
    static evaluateTrade(state: GameState, config: MapConfig, trade: TradeState, evaluatorId: PlayerId): TradeEvaluationResult;
    private static calculateOfferValue;
}
//# sourceMappingURL=TradeEvaluator.d.ts.map