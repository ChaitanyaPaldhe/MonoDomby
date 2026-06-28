import type { GameState } from '@monopoly/shared';
import type { MapConfig } from '@monopoly/shared';
import type { WinCheckResult } from './types.js';
/**
 * Checks whether the current game state satisfies any victory condition.
 *
 * Called by GameEngine after every successful state transition.
 * Returns WinCheckResult { won: false } in the vast majority of cases.
 */
export declare class WinDetector {
    /**
     * Check the current state against the configured win condition.
     *
     * @param state - The post-transition game state.
     * @param mapConfig - Map configuration containing win condition settings.
     * @returns WinCheckResult — won: false if game continues, won: true with winnerId.
     */
    check(state: GameState, mapConfig: MapConfig): WinCheckResult;
    /**
     * Last Standing — game ends when only 1 non-bankrupt player remains.
     *
     * This is the only win condition implemented so far; it is also the minimum
     * required to prevent the engine from throwing during normal gameplay.
     */
    private checkLastStanding;
    /**
     * TODO: Net Worth Target — first player to reach mapConfig.rules.netWorthTarget wins.
     *
     * Algorithm:
     * 1. Read netWorthTarget from mapConfig.rules.netWorthTarget.
     * 2. Check each player's netWorth.
     * 3. If any non-bankrupt player has netWorth >= target, they win.
     * 4. Tie-break: if multiple players hit the target on the same turn, highest netWorth wins.
     */
    private checkNetWorthTarget;
    /**
     * TODO: Turn Limit — game ends after mapConfig.rules.turnLimit turns.
     * The player with the highest netWorth wins.
     *
     * Algorithm:
     * 1. Read turnLimit from mapConfig.rules.turnLimit.
     * 2. If state.turn.turnNumber > turnLimit, compute rankings.
     * 3. Winner = highest netWorth among non-bankrupt players.
     */
    private checkTurnLimit;
    /**
     * Get all non-bankrupt player IDs sorted by netWorth descending.
     * @internal
     */
    private rankPlayers;
}
//# sourceMappingURL=WinDetector.d.ts.map