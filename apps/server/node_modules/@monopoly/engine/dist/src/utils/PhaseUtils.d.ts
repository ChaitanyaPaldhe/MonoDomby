import { GameState } from '@monopoly/shared';
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
export declare function canManageProperties(state: GameState): boolean;
//# sourceMappingURL=PhaseUtils.d.ts.map