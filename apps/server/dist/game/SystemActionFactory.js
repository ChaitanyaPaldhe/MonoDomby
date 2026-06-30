import { ActionType } from '@monopoly/shared';
/**
 * Generates deterministic system actions triggered by the orchestration layer.
 * These actions bypass client intervention and are injected directly into the ActionQueue.
 *
 * To ensure replay determinism, system actions derive their ID and timestamp
 * from the deterministic GameState rather than relying on non-deterministic Date.now() or random UUIDs.
 */
export class SystemActionFactory {
    static generateSystemActionId(state, actionType) {
        return `sys-${actionType}-${state.version}`;
    }
    static getDeterministicTimestamp(state) {
        // In a replay-safe environment, system actions can use a fixed offset from the last processed turn
        // or just a 0 timestamp, since the engine's state determines behavior, not the wall clock.
        return 0;
    }
    static createAutoEndTurn(state, playerId) {
        return {
            actionId: this.generateSystemActionId(state, 'END_TURN'),
            type: ActionType.END_TURN,
            playerId,
            roomId: state.roomId,
            clientTs: this.getDeterministicTimestamp(state)
        }; // Type override since we are forcefully generating system actions
    }
    static createAutoDeclinePurchase(state, playerId) {
        return {
            actionId: this.generateSystemActionId(state, 'DECLINE_PURCHASE'),
            type: ActionType.DECLINE_PROPERTY,
            playerId,
            roomId: state.roomId,
            clientTs: this.getDeterministicTimestamp(state)
        };
    }
    static createAutoBankruptcy(state, playerId) {
        return {
            actionId: this.generateSystemActionId(state, 'DECLARE_BANKRUPTCY'),
            type: ActionType.DECLARE_BANKRUPTCY,
            playerId,
            roomId: state.roomId,
            clientTs: this.getDeterministicTimestamp(state)
        };
    }
}
//# sourceMappingURL=SystemActionFactory.js.map