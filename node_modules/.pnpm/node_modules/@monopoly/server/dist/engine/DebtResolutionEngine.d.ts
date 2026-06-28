import { GameState, MapConfig } from '@monopoly/shared';
export declare class DebtResolutionEngine {
    /**
     * Checks if the active player is in DEBT_RECOVERY and has enough cash to settle.
     * If so, settles the debt, clears the pending decision, and emits events.
     * Otherwise, returns the state unchanged.
     */
    static checkAndSettleDebt(state: GameState, config: MapConfig, actionId: string, clientTs: number): {
        newState: GameState;
        events: any[];
    };
}
//# sourceMappingURL=DebtResolutionEngine.d.ts.map