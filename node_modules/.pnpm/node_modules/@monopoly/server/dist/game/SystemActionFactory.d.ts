import { PlayerId, ClientAction, GameState } from '@monopoly/shared';
/**
 * Generates deterministic system actions triggered by the orchestration layer.
 * These actions bypass client intervention and are injected directly into the ActionQueue.
 *
 * To ensure replay determinism, system actions derive their ID and timestamp
 * from the deterministic GameState rather than relying on non-deterministic Date.now() or random UUIDs.
 */
export declare class SystemActionFactory {
    private static generateSystemActionId;
    private static getDeterministicTimestamp;
    static createAutoEndTurn(state: GameState, playerId: PlayerId): ClientAction;
    static createAutoDeclinePurchase(state: GameState, playerId: PlayerId): ClientAction;
    static createAutoBankruptcy(state: GameState, playerId: PlayerId): ClientAction;
}
//# sourceMappingURL=SystemActionFactory.d.ts.map