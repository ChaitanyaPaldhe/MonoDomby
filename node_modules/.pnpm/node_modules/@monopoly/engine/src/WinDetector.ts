// =============================================================================
// engine/WinDetector.ts
// Victory condition checker.
//
// Design:
// - Called after every state transition.
// - Reads MapConfig.rules.winCondition to determine which check to run.
// - Pure function — no side effects.
// =============================================================================

import { WinCondition } from '@monopoly/shared';
import type { GameState, PlayerId } from '@monopoly/shared';
import type { MapConfig } from '@monopoly/maps';;
import type { WinCheckResult } from './types.js';

// ---------------------------------------------------------------------------
// WinDetector
// ---------------------------------------------------------------------------

/**
 * Checks whether the current game state satisfies any victory condition.
 *
 * Called by GameEngine after every successful state transition.
 * Returns WinCheckResult { won: false } in the vast majority of cases.
 */
export class WinDetector {
  /**
   * Check the current state against the configured win condition.
   *
   * @param state - The post-transition game state.
   * @param mapConfig - Map configuration containing win condition settings.
   * @returns WinCheckResult — won: false if game continues, won: true with winnerId.
   */
  check(state: GameState, mapConfig: MapConfig): WinCheckResult {
    const { winCondition } = mapConfig.rules;

    switch (winCondition) {
      case WinCondition.LAST_STANDING:
        return this.checkLastStanding(state);

      case WinCondition.NET_WORTH_TARGET:
        return this.checkNetWorthTarget(state, mapConfig);

      case WinCondition.TURN_LIMIT:
        return this.checkTurnLimit(state, mapConfig);

      default: {
        // TypeScript exhaustive check
        const _exhaustive: never = winCondition;
        throw new Error(`[WIN_DETECTOR] Unknown win condition: ${String(_exhaustive)}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Win Condition Implementations
  // -------------------------------------------------------------------------

  /**
   * Last Standing — game ends when only 1 non-bankrupt player remains.
   *
   * This is the only win condition implemented so far; it is also the minimum
   * required to prevent the engine from throwing during normal gameplay.
   */
  private checkLastStanding(state: GameState): WinCheckResult {
    const activePlayers = state.playerOrder.filter(
      id => state.players[id] && !state.players[id]!.isBankrupt,
    );

    if (activePlayers.length === 1) {
      return {
        won: true,
        winnerId: activePlayers[0]!,
        reason: 'Last non-bankrupt player',
      };
    }

    // Edge case: all bankrupt (invalid state — return won: false to avoid crash)
    return { won: false };
  }

  /**
   * TODO: Net Worth Target — first player to reach mapConfig.rules.netWorthTarget wins.
   *
   * Algorithm:
   * 1. Read netWorthTarget from mapConfig.rules.netWorthTarget.
   * 2. Check each player's netWorth.
   * 3. If any non-bankrupt player has netWorth >= target, they win.
   * 4. Tie-break: if multiple players hit the target on the same turn, highest netWorth wins.
   */
  private checkNetWorthTarget(state: GameState, mapConfig: MapConfig): WinCheckResult {
    // TODO: Implement full net-worth-target check
    return { won: false };
  }

  /**
   * TODO: Turn Limit — game ends after mapConfig.rules.turnLimit turns.
   * The player with the highest netWorth wins.
   *
   * Algorithm:
   * 1. Read turnLimit from mapConfig.rules.turnLimit.
   * 2. If state.turn.turnNumber > turnLimit, compute rankings.
   * 3. Winner = highest netWorth among non-bankrupt players.
   */
  private checkTurnLimit(state: GameState, mapConfig: MapConfig): WinCheckResult {
    // TODO: Implement full turn-limit check
    return { won: false };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Get all non-bankrupt player IDs sorted by netWorth descending.
   * @internal
   */
  private rankPlayers(state: GameState): PlayerId[] {
    return state.playerOrder
      .filter(id => !state.players[id]?.isBankrupt)
      .sort((a, b) => {
        const netWorthA = state.players[a]?.netWorth ?? 0;
        const netWorthB = state.players[b]?.netWorth ?? 0;
        return netWorthB - netWorthA;
      });
  }
}
