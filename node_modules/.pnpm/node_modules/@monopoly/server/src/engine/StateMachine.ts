// =============================================================================
// engine/StateMachine.ts
// Finite State Machine for game phase and turn phase transitions.
//
// Design:
// - All transitions are explicitly enumerated. Unknown transitions throw.
// - transition* functions return NEW state objects — they never mutate.
// - The FSM is the single source of truth for what phase changes are legal.
// =============================================================================

import { GamePhase, TurnPhase } from '@monopoly/shared';
import type { GameState, TurnState, PlayerId } from '@monopoly/shared';
import { EngineTransitionError } from './errors.js';

// ---------------------------------------------------------------------------
// Transition Maps
// ---------------------------------------------------------------------------

/**
 * Valid game-level phase transitions.
 * Key = from, Value = set of valid `to` phases.
 */
const GAME_TRANSITIONS: Readonly<Record<GamePhase, ReadonlySet<GamePhase>>> = {
  [GamePhase.LOBBY]: new Set([GamePhase.STARTING]),
  [GamePhase.STARTING]: new Set([GamePhase.IN_PROGRESS]),
  [GamePhase.IN_PROGRESS]: new Set([GamePhase.AUCTION, GamePhase.ENDED]),
  [GamePhase.AUCTION]: new Set([GamePhase.IN_PROGRESS, GamePhase.ENDED]),
  [GamePhase.ENDED]: new Set(),
};

/**
 * Valid turn-phase transitions within a single player's turn.
 * Key = from, Value = set of valid `to` turn phases.
 */
const TURN_TRANSITIONS: Readonly<Record<TurnPhase, ReadonlySet<TurnPhase>>> = {
  [TurnPhase.PRE_ROLL]: new Set([
    TurnPhase.ROLLED,        // Normal dice roll
    TurnPhase.JAIL_DECISION, // Player is in jail — must decide before rolling
  ]),
  [TurnPhase.ROLLED]: new Set([
    TurnPhase.PURCHASE_DECISION, // Landed on unowned buyable tile
    TurnPhase.JAIL_DECISION,     // Sent to jail (3× doubles or GO_TO_JAIL tile)
    TurnPhase.CARD_DRAWN,        // Landed on Chance/Community Chest
    TurnPhase.POST_ROLL,         // All effects resolved inline (tax, rent, GO, etc.)
    TurnPhase.PRE_ROLL,          // Doubles: player rolls again immediately
  ]),
  [TurnPhase.PURCHASE_DECISION]: new Set([
    TurnPhase.POST_ROLL, // Bought it, or declined (auction starts as a side-effect event)
    TurnPhase.PRE_ROLL,  // Rare: buying triggers GO pass which starts next part of turn
  ]),
  [TurnPhase.JAIL_DECISION]: new Set([
    TurnPhase.PRE_ROLL, // Paid fine or used card — now must roll
    TurnPhase.ROLLED,   // Rolled for doubles from jail (result already known)
    TurnPhase.POST_ROLL, // Served max time and paid fine — no roll
  ]),
  [TurnPhase.CARD_DRAWN]: new Set([
    TurnPhase.POST_ROLL,     // Card resolved, no movement
    TurnPhase.PURCHASE_DECISION, // Card moved player to an unowned tile
    TurnPhase.JAIL_DECISION,     // Card sent player to jail
    TurnPhase.PRE_ROLL,         // Card teleported to a tile with no blocking effect
  ]),
  [TurnPhase.POST_ROLL]: new Set([
    TurnPhase.PRE_ROLL, // End turn → advance to next player (or same on doubles)
  ]),
};

// ---------------------------------------------------------------------------
// StateMachine
// ---------------------------------------------------------------------------

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
export class StateMachine {
  // -------------------------------------------------------------------------
  // Game Phase
  // -------------------------------------------------------------------------

  /**
   * Check whether a game-phase transition is legal.
   */
  canTransitionGame(from: GamePhase, to: GamePhase): boolean {
    return GAME_TRANSITIONS[from].has(to);
  }

  /**
   * Transition the game to a new phase.
   * @throws {EngineTransitionError} if the transition is not allowed.
   */
  transitionGame(state: GameState, to: GamePhase): GameState {
    if (!this.canTransitionGame(state.phase, to)) {
      throw new EngineTransitionError(state.phase, to);
    }
    return {
      ...state,
      phase: to,
      version: state.version + 1,
    };
  }

  // -------------------------------------------------------------------------
  // Turn Phase
  // -------------------------------------------------------------------------

  /**
   * Check whether a turn-phase transition is legal.
   */
  canTransitionTurn(from: TurnPhase, to: TurnPhase): boolean {
    return TURN_TRANSITIONS[from].has(to);
  }

  /**
   * Transition the current turn to a new sub-phase.
   * @throws {EngineTransitionError} if the transition is not allowed.
   */
  transitionTurn(state: GameState, to: TurnPhase): GameState {
    const from = state.turn.phase;
    if (!this.canTransitionTurn(from, to)) {
      throw new EngineTransitionError(`TurnPhase.${from}`, `TurnPhase.${to}`);
    }
    return {
      ...state,
      version: state.version + 1,
      turn: {
        ...state.turn,
        phase: to,
        // Clear pending decision when phase moves forward (it was resolved)
        pendingDecision: to === TurnPhase.POST_ROLL || to === TurnPhase.PRE_ROLL
          ? null
          : state.turn.pendingDecision,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Turn Advancement
  // -------------------------------------------------------------------------

  /**
   * Advance play to the next player in the turn order.
   * Wraps around to the start of the order.
   * Skips bankrupt players automatically.
   *
   * @returns New GameState with the next player as current and TurnPhase = PRE_ROLL.
   */
  advanceToNextPlayer(
    state: GameState,
    turnExpiresAt: number,
  ): GameState {
    const nextPlayerId = this.resolveNextPlayer(state);
    const nextTurn: TurnState = {
      currentPlayerId: nextPlayerId,
      turnNumber: state.turn.turnNumber + 1,
      phase: TurnPhase.PRE_ROLL,
      diceValues: null,
      isDoubles: false,
      consecutiveDoubles: 0,
      turnExpiresAt,
      pendingDecision: null,
    };
    return {
      ...state,
      version: state.version + 1,
      turn: nextTurn,
    };
  }

  /**
   * Reset turn for the same player (doubles — they roll again).
   * Preserves consecutiveDoubles count increment.
   */
  resetTurnForDoubles(state: GameState, turnExpiresAt: number): GameState {
    const nextTurn: TurnState = {
      ...state.turn,
      phase: TurnPhase.PRE_ROLL,
      diceValues: null,
      isDoubles: false,
      consecutiveDoubles: state.turn.consecutiveDoubles + 1,
      turnExpiresAt,
      pendingDecision: null,
    };
    return {
      ...state,
      version: state.version + 1,
      turn: nextTurn,
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Resolve the ID of the next active (non-bankrupt, connected-or-disconnected) player.
   */
  private resolveNextPlayer(state: GameState): PlayerId {
    const order = state.playerOrder;
    const currentIndex = order.indexOf(state.turn.currentPlayerId);
    const totalPlayers = order.length;

    for (let i = 1; i <= totalPlayers; i++) {
      const candidateIndex = (currentIndex + i) % totalPlayers;
      const candidateId = order[candidateIndex];
      if (candidateId === undefined) continue;
      const candidate = state.players[candidateId];
      if (candidate && !candidate.isBankrupt) {
        return candidateId;
      }
    }

    // Should never reach here in a valid game state (at least 1 non-bankrupt player)
    throw new Error('[STATE_MACHINE] No eligible next player found. Game should have ended.');
  }

  /**
   * Count the number of non-bankrupt players remaining.
   * Used by WinDetector.
   */
  countActivePlayers(state: GameState): number {
    return state.playerOrder.filter(
      id => state.players[id] && !state.players[id]!.isBankrupt,
    ).length;
  }
}
