import { GamePhase, TurnPhase, GameState, DecisionType } from '@monopoly/shared';

/**
 * Validates whether property management (building/selling houses/hotels, mortgaging, etc.)
 * is allowed in the current game state.
 *
 * Rules:
 * - Game must be IN_PROGRESS.
 * - No pending decisions (except DEBT_RECOVERY).
 * - No active auctions.
 * - No pending card executions (like CARD_DRAWN).
 */
export function canManageProperties(state: GameState): boolean {
  if (state.phase !== GamePhase.IN_PROGRESS) {
    return false;
  }

  // Must not have any pending decision for the current turn (unless DEBT_RECOVERY)
  if (state.turn.pendingDecision !== null && state.turn.pendingDecision.type !== DecisionType.DEBT_RECOVERY) {
    return false;
  }

  // Must not be in CARD_DRAWN phase
  if (state.turn.phase === TurnPhase.CARD_DRAWN) {
    return false;
  }

  // Future check: No active auction
  if ((state as any).auction) {
    return false;
  }

  return true;
}
