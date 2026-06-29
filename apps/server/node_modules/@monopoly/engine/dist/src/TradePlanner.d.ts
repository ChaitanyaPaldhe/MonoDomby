import type { MapConfig } from '@monopoly/maps';
export interface TradeExecutionPlan {
    readonly tradeId: TradeId;
    readonly finalTrade: TradeState;
    readonly initiatorId: PlayerId;
    readonly targetId: PlayerId;
    readonly initiatorMoneyChange: number;
    readonly targetMoneyChange: number;
    readonly bankMoneyChange: number;
    readonly requiredDebtRecoveryPlans: readonly {
        readonly playerId: PlayerId;
        readonly amountOwed: number;
        readonly creditorId: PlayerId | null;
    }[];
}
export declare class TradePlanner {
    static validateTradeOffer(offer: TradeOffer, state: GameState, playerId: PlayerId, config: MapConfig): void;
    static planTradeProposal(state: GameState, config: MapConfig, initiatorId: PlayerId, targetId: PlayerId, offer: TradeOffer, request: TradeOffer, tradeId: TradeId, currentTurn: number): TradeState;
    static planTradeExecution(state: GameState, config: MapConfig, trade: TradeState): TradeExecutionPlan;
}
//# sourceMappingURL=TradePlanner.d.ts.map