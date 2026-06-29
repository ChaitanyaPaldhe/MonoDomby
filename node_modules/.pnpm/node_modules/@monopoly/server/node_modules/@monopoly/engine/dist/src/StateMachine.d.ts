import { GamePhase, TurnPhase } from '@monopoly/shared';
import type { GameState } from '@monopoly/shared';
/**
 * Finite State Machine for the Monopoly engine.
 *
 * Responsibilities:
 * 1. Guard all phase transitions (throws on illegal transitions).
 * 2. Produce new GameState objects with updated phase fields.
 * 3. Advance turn to the next player.
 *
 * Pure class — all methods return new state; nothing is mutated.
 */
export declare class StateMachine {
    /**
     * Check whether a game-phase transition is legal.
     */
    canTransitionGame(from: GamePhase, to: GamePhase): boolean;
    /**
     * Transition the game to a new phase.
     * @throws {EngineTransitionError} if the transition is not allowed.
     */
    transitionGame(state: GameState, to: GamePhase): GameState;
    /**
     * Check whether a turn-phase transition is legal.
     */
    canTransitionTurn(from: TurnPhase, to: TurnPhase): boolean;
    /**
     * Transition the current turn to a new sub-phase.
     * @throws {EngineTransitionError} if the transition is not allowed.
     */
    transitionTurn(state: GameState, to: TurnPhase): GameState;
    /**
     * Advance play to the next player in the turn order.
     * Wraps around to the start of the order.
     * Skips bankrupt players automatically.
     *
     * @returns New GameState with the next player as current and TurnPhase = PRE_ROLL.
     */
    advanceToNextPlayer(state: GameState, turnExpiresAt: number): GameState;
    /**
     * Reset turn for the same player (doubles — they roll again).
     * Preserves consecutiveDoubles count increment.
     */
    resetTurnForDoubles(state: GameState, turnExpiresAt: number): GameState;
    /**
     * Resolve the ID of the next active (non-bankrupt, connected-or-disconnected) player.
     */
    private resolveNextPlayer;
    /**
     * Count the number of non-bankrupt players remaining.
     * Used by WinDetector.
     */
    countActivePlayers(state: GameState): number;
}
//# sourceMappingURL=StateMachine.d.ts.map