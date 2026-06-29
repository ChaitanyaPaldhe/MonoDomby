"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const GameEngine_js_1 = require("../../../src/engine/GameEngine.js");
const errors_js_1 = require("../../../src/engine/errors.js");
const shared_1 = require("@monopoly/shared");
(0, vitest_1.describe)('END_TURN Action', () => {
    const P1 = 'player-1';
    const P2 = 'player-2';
    const P3 = 'player-3';
    let engine;
    let config;
    let baseState;
    (0, vitest_1.beforeEach)(() => {
        config = {
            meta: { id: 'test-map' },
            gameRules: { turnDurationMs: 60000 },
            rules: { winCondition: shared_1.WinCondition.LAST_STANDING },
            board: {
                tiles: [{ id: 'go', index: 0, type: 'GO' }],
            },
        };
        baseState = {
            id: 'game-1',
            roomId: 'room-1',
            version: 1,
            phase: shared_1.GamePhase.IN_PROGRESS,
            players: {
                [P1]: { playerId: P1, isBankrupt: false, jailState: null },
                [P2]: { playerId: P2, isBankrupt: false, jailState: null },
                [P3]: { playerId: P3, isBankrupt: false, jailState: null },
            },
            playerOrder: [P1, P2, P3],
            turn: {
                currentPlayerId: P1,
                turnNumber: 1,
                phase: shared_1.TurnPhase.POST_ROLL,
                diceValues: [3, 4],
                isDoubles: false,
                consecutiveDoubles: 0,
                turnExpiresAt: 1000,
                pendingDecision: null,
            },
            activeTrades: {},
            auction: null,
            board: { tiles: {} },
            bank: { houses: 32, hotels: 12 },
        };
        engine = new GameEngine_js_1.GameEngine();
    });
    const createAction = (ts) => ({
        actionId: `action-${ts}`,
        clientTs: ts,
        type: shared_1.ActionType.END_TURN,
        payload: {},
    });
    (0, vitest_1.describe)('Validation', () => {
        (0, vitest_1.it)('fails if player is not the active player', () => {
            try {
                engine.apply(baseState, createAction(2000), config, P2);
                vitest_1.expect.fail('Should have thrown EngineValidationError');
            }
            catch (e) {
                (0, vitest_1.expect)(e).toBeInstanceOf(errors_js_1.EngineValidationError);
                (0, vitest_1.expect)(e.code).toBe('E_NOT_YOUR_TURN');
            }
        });
        (0, vitest_1.it)('fails if the turn phase is not POST_ROLL', () => {
            const state = { ...baseState, turn: { ...baseState.turn, phase: shared_1.TurnPhase.PRE_ROLL } };
            try {
                engine.apply(state, createAction(2000), config, P1);
                vitest_1.expect.fail('Should have thrown EngineValidationError');
            }
            catch (e) {
                (0, vitest_1.expect)(e).toBeInstanceOf(errors_js_1.EngineValidationError);
                (0, vitest_1.expect)(e.code).toBe('E_INVALID_PHASE');
            }
        });
        (0, vitest_1.it)('fails if there is a pending decision', () => {
            const state = { ...baseState, turn: { ...baseState.turn, pendingDecision: { type: 'PURCHASE' } } };
            try {
                engine.apply(state, createAction(2000), config, P1);
                vitest_1.expect.fail('Should have thrown EngineValidationError');
            }
            catch (e) {
                (0, vitest_1.expect)(e).toBeInstanceOf(errors_js_1.EngineValidationError);
                (0, vitest_1.expect)(e.code).toBe('E_PENDING_DECISION');
            }
        });
        (0, vitest_1.it)('fails if there is an active auction', () => {
            const state = { ...baseState, auction: { id: 'auc-1' } };
            try {
                engine.apply(state, createAction(2000), config, P1);
                vitest_1.expect.fail('Should have thrown EngineValidationError');
            }
            catch (e) {
                (0, vitest_1.expect)(e).toBeInstanceOf(errors_js_1.EngineValidationError);
                (0, vitest_1.expect)(e.code).toBe('E_INVALID_ACTION');
                (0, vitest_1.expect)(e.message).toMatch(/auction is active/);
            }
        });
        (0, vitest_1.it)('fails if there are active trades', () => {
            const state = { ...baseState, activeTrades: { 'trade-1': {} } };
            try {
                engine.apply(state, createAction(2000), config, P1);
                vitest_1.expect.fail('Should have thrown EngineValidationError');
            }
            catch (e) {
                (0, vitest_1.expect)(e).toBeInstanceOf(errors_js_1.EngineValidationError);
                (0, vitest_1.expect)(e.code).toBe('E_INVALID_ACTION');
                (0, vitest_1.expect)(e.message).toMatch(/active trades/);
            }
        });
    });
    (0, vitest_1.describe)('Normal Turn End (no doubles)', () => {
        (0, vitest_1.it)('advances to the next player and transitions to PRE_ROLL', () => {
            const action = createAction(2000);
            const result = engine.apply(baseState, action, config, P1);
            const { newState: state } = result;
            (0, vitest_1.expect)(state.turn.currentPlayerId).toBe(P2);
            (0, vitest_1.expect)(state.turn.phase).toBe(shared_1.TurnPhase.PRE_ROLL);
            (0, vitest_1.expect)(state.turn.turnNumber).toBe(2);
            (0, vitest_1.expect)(state.turn.isDoubles).toBe(false);
            (0, vitest_1.expect)(state.turn.consecutiveDoubles).toBe(0);
            (0, vitest_1.expect)(state.turn.turnExpiresAt).toBe(2000 + 60000);
        });
        (0, vitest_1.it)('emits TURN_ENDED and TURN_STARTED events', () => {
            const action = createAction(2000);
            const result = engine.apply(baseState, action, config, P1);
            const { events } = result;
            (0, vitest_1.expect)(events).toHaveLength(2);
            (0, vitest_1.expect)(events[0].type).toBe(shared_1.EventType.TURN_ENDED);
            (0, vitest_1.expect)(events[0].payload.playerId).toBe(P1);
            (0, vitest_1.expect)(events[1].type).toBe(shared_1.EventType.TURN_STARTED);
            (0, vitest_1.expect)(events[1].payload.playerId).toBe(P2);
        });
        (0, vitest_1.it)('skips bankrupt players automatically', () => {
            const state = {
                ...baseState,
                players: {
                    ...baseState.players,
                    [P2]: { ...baseState.players[P2], isBankrupt: true },
                },
            };
            const result = engine.apply(state, createAction(2000), config, P1);
            (0, vitest_1.expect)(result.newState.turn.currentPlayerId).toBe(P3);
        });
        (0, vitest_1.it)('wraps around to the first player after the last player', () => {
            const state = { ...baseState, turn: { ...baseState.turn, currentPlayerId: P3 } };
            const result = engine.apply(state, createAction(2000), config, P3);
            (0, vitest_1.expect)(result.newState.turn.currentPlayerId).toBe(P1);
        });
    });
    (0, vitest_1.describe)('Doubles Extra Turn', () => {
        (0, vitest_1.it)('grants another turn to the same player if they rolled doubles and are not in jail', () => {
            const state = {
                ...baseState,
                turn: { ...baseState.turn, isDoubles: true, consecutiveDoubles: 1 },
            };
            const action = createAction(2000);
            const result = engine.apply(state, action, config, P1);
            (0, vitest_1.expect)(result.newState.turn.currentPlayerId).toBe(P1); // Same player
            (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.PRE_ROLL);
            (0, vitest_1.expect)(result.newState.turn.consecutiveDoubles).toBe(2); // Kept the incremented value
            (0, vitest_1.expect)(result.newState.turn.isDoubles).toBe(false); // Reset for the new roll
            (0, vitest_1.expect)(result.newState.turn.turnNumber).toBe(1); // Still the same turn number logically
        });
        (0, vitest_1.it)('emits TURN_ENDED, EXTRA_TURN_GRANTED, and TURN_STARTED', () => {
            const state = {
                ...baseState,
                turn: { ...baseState.turn, isDoubles: true },
            };
            const result = engine.apply(state, createAction(2000), config, P1);
            (0, vitest_1.expect)(result.events).toHaveLength(3);
            (0, vitest_1.expect)(result.events[0].type).toBe(shared_1.EventType.TURN_ENDED);
            (0, vitest_1.expect)(result.events[1].type).toBe(shared_1.EventType.EXTRA_TURN_GRANTED);
            (0, vitest_1.expect)(result.events[2].type).toBe(shared_1.EventType.TURN_STARTED);
        });
        (0, vitest_1.it)('advances to the next player if they rolled doubles but are in jail', () => {
            const state = {
                ...baseState,
                players: {
                    ...baseState.players,
                    [P1]: { ...baseState.players[P1], jailState: { turnsServed: 0, reason: 'DOUBLES', jailedAt: 1000 } },
                },
                turn: { ...baseState.turn, isDoubles: true, consecutiveDoubles: 3 }, // E.g., triple doubles
            };
            const result = engine.apply(state, createAction(2000), config, P1);
            (0, vitest_1.expect)(result.newState.turn.currentPlayerId).toBe(P2); // Next player!
            (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.PRE_ROLL);
            // Should not grant extra turn
            (0, vitest_1.expect)(result.events.find(e => e.type === shared_1.EventType.EXTRA_TURN_GRANTED)).toBeUndefined();
        });
    });
    (0, vitest_1.describe)('Immutability and Determinism', () => {
        (0, vitest_1.it)('does not mutate the input state', () => {
            const originalStateJson = JSON.stringify(baseState);
            engine.apply(baseState, createAction(2000), config, P1);
            (0, vitest_1.expect)(JSON.stringify(baseState)).toBe(originalStateJson);
        });
        (0, vitest_1.it)('increments version exactly by 1 (machine transition + action)', () => {
            const result = engine.apply(baseState, createAction(2000), config, P1);
            (0, vitest_1.expect)(result.newState.version).toBe(baseState.version + 1); // 1 from StateMachine
        });
        (0, vitest_1.it)('produces identical state for identical input', () => {
            const action = createAction(2000);
            const res1 = engine.apply(baseState, action, config, P1);
            const res2 = engine.apply(baseState, action, config, P1);
            (0, vitest_1.expect)(res1).toEqual(res2);
        });
    });
});
//# sourceMappingURL=EndTurn.test.js.map