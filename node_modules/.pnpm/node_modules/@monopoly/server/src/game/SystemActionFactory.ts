import { PlayerId, ClientAction, GameState, GameEvent, ActionType } from '@monopoly/shared';
import { GameEngine } from '@monopoly/engine';
/**
 * Generates deterministic system actions triggered by the orchestration layer.
 * These actions bypass client intervention and are injected directly into the ActionQueue.
 * 
 * To ensure replay determinism, system actions derive their ID and timestamp
 * from the deterministic GameState rather than relying on non-deterministic Date.now() or random UUIDs.
 */
export class SystemActionFactory {
  
  private static generateSystemActionId(state: GameState, actionType: string): string {
    return `sys-${actionType}-${state.version}`;
  }

  private static getDeterministicTimestamp(state: GameState): number {
    // In a replay-safe environment, system actions can use a fixed offset from the last processed turn
    // or just a 0 timestamp, since the engine's state determines behavior, not the wall clock.
    return 0; 
  }

  public static createAutoEndTurn(state: GameState, playerId: PlayerId): ClientAction {
    return {
      actionId: this.generateSystemActionId(state, 'END_TURN'),
      type: ActionType.END_TURN,
      playerId,
      roomId: state.roomId,
      clientTs: this.getDeterministicTimestamp(state)
    } as any; // Type override since we are forcefully generating system actions
  }

  public static createAutoDeclinePurchase(state: GameState, playerId: PlayerId): ClientAction {
    return {
      actionId: this.generateSystemActionId(state, 'DECLINE_PURCHASE'),
      type: ActionType.DECLINE_PROPERTY,
      playerId,
      roomId: state.roomId,
      clientTs: this.getDeterministicTimestamp(state)
    } as any;
  }

  public static createAutoBankruptcy(state: GameState, playerId: PlayerId): ClientAction {
    return {
      actionId: this.generateSystemActionId(state, 'DECLARE_BANKRUPTCY'),
      type: ActionType.DECLARE_BANKRUPTCY,
      playerId,
      roomId: state.roomId,
      clientTs: this.getDeterministicTimestamp(state)
    } as any;
  }
}