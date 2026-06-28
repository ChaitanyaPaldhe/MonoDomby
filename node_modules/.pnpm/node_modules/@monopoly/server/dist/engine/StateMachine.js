"use strict";
// =============================================================================
// engine/StateMachine.ts
// Finite State Machine for game phase and turn phase transitions.
//
// Design:
// - All transitions are explicitly enumerated. Unknown transitions throw.
// - transition* functions return NEW state objects — they never mutate.
// - The FSM is the single source of truth for what phase changes are legal.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateMachine = void 0;
const shared_1 = require("@monopoly/shared");
const errors_js_1 = require("./errors.js");
// ---------------------------------------------------------------------------
// Transition Maps
// ---------------------------------------------------------------------------
/**
 * Valid game-level phase transitions.
 * Key = from, Value = set of valid `to` phases.
 */
const GAME_TRANSITIONS = {
    [shared_1.GamePhase.LOBBY]: new Set([shared_1.GamePhase.STARTING]),
    [shared_1.GamePhase.STARTING]: new Set([shared_1.GamePhase.IN_PROGRESS]),
    [shared_1.GamePhase.IN_PROGRESS]: new Set([shared_1.GamePhase.AUCTION, shared_1.GamePhase.ENDED]),
    [shared_1.GamePhase.AUCTION]: new Set([shared_1.GamePhase.IN_PROGRESS, shared_1.GamePhase.ENDED]),
    [shared_1.GamePhase.ENDED]: new Set(),
};
/**
 * Valid turn-phase transitions within a single player's turn.
 * Key = from, Value = set of valid `to` turn phases.
 */
const TURN_TRANSITIONS = {
    [shared_1.TurnPhase.PRE_ROLL]: new Set([
        shared_1.TurnPhase.ROLLED, // Normal dice roll
        shared_1.TurnPhase.JAIL_DECISION, // Player is in jail — must decide before rolling
    ]),
    [shared_1.TurnPhase.ROLLED]: new Set([
        shared_1.TurnPhase.PURCHASE_DECISION, // Landed on unowned buyable tile
        shared_1.TurnPhase.JAIL_DECISION, // Sent to jail (3× doubles or GO_TO_JAIL tile)
        shared_1.TurnPhase.CARD_DRAWN, // Landed on Chance/Community Chest
        shared_1.TurnPhase.POST_ROLL, // All effects resolved inline (tax, rent, GO, etc.)
        shared_1.TurnPhase.PRE_ROLL, // Doubles: player rolls again immediately
    ]),
    [shared_1.TurnPhase.PURCHASE_DECISION]: new Set([
        shared_1.TurnPhase.POST_ROLL, // Bought it, or declined (auction starts as a side-effect event)
        shared_1.TurnPhase.PRE_ROLL, // Rare: buying triggers GO pass which starts next part of turn
    ]),
    [shared_1.TurnPhase.JAIL_DECISION]: new Set([
        shared_1.TurnPhase.PRE_ROLL, // Paid fine or used card — now must roll
        shared_1.TurnPhase.ROLLED, // Rolled for doubles from jail (result already known)
        shared_1.TurnPhase.POST_ROLL, // Served max time and paid fine — no roll
    ]),
    [shared_1.TurnPhase.CARD_DRAWN]: new Set([
        shared_1.TurnPhase.POST_ROLL, // Card resolved, no movement
        shared_1.TurnPhase.PURCHASE_DECISION, // Card moved player to an unowned tile
        shared_1.TurnPhase.JAIL_DECISION, // Card sent player to jail
        shared_1.TurnPhase.PRE_ROLL, // Card teleported to a tile with no blocking effect
    ]),
    [shared_1.TurnPhase.POST_ROLL]: new Set([
        shared_1.TurnPhase.PRE_ROLL, // End turn → advance to next player (or same on doubles)
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
class StateMachine {
    // -------------------------------------------------------------------------
    // Game Phase
    // -------------------------------------------------------------------------
    /**
     * Check whether a game-phase transition is legal.
     */
    canTransitionGame(from, to) {
        return GAME_TRANSITIONS[from].has(to);
    }
    /**
     * Transition the game to a new phase.
     * @throws {EngineTransitionError} if the transition is not allowed.
     */
    transitionGame(state, to) {
        if (!this.canTransitionGame(state.phase, to)) {
            throw new errors_js_1.EngineTransitionError(state.phase, to);
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
    canTransitionTurn(from, to) {
        return TURN_TRANSITIONS[from].has(to);
    }
    /**
     * Transition the current turn to a new sub-phase.
     * @throws {EngineTransitionError} if the transition is not allowed.
     */
    transitionTurn(state, to) {
        const from = state.turn.phase;
        if (!this.canTransitionTurn(from, to)) {
            throw new errors_js_1.EngineTransitionError(`TurnPhase.${from}`, `TurnPhase.${to}`);
        }
        return {
            ...state,
            version: state.version + 1,
            turn: {
                ...state.turn,
                phase: to,
                // Clear pending decision when phase moves forward (it was resolved)
                pendingDecision: to === shared_1.TurnPhase.POST_ROLL || to === shared_1.TurnPhase.PRE_ROLL
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
    advanceToNextPlayer(state, turnExpiresAt) {
        const nextPlayerId = this.resolveNextPlayer(state);
        const nextTurn = {
            currentPlayerId: nextPlayerId,
            turnNumber: state.turn.turnNumber + 1,
            phase: shared_1.TurnPhase.PRE_ROLL,
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
    resetTurnForDoubles(state, turnExpiresAt) {
        const nextTurn = {
            ...state.turn,
            phase: shared_1.TurnPhase.PRE_ROLL,
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
    resolveNextPlayer(state) {
        const order = state.playerOrder;
        const currentIndex = order.indexOf(state.turn.currentPlayerId);
        const totalPlayers = order.length;
        for (let i = 1; i <= totalPlayers; i++) {
            const candidateIndex = (currentIndex + i) % totalPlayers;
            const candidateId = order[candidateIndex];
            if (candidateId === undefined)
                continue;
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
    countActivePlayers(state) {
        return state.playerOrder.filter(id => state.players[id] && !state.players[id].isBankrupt).length;
    }
}
exports.StateMachine = StateMachine;
//# sourceMappingURL=StateMachine.js.map