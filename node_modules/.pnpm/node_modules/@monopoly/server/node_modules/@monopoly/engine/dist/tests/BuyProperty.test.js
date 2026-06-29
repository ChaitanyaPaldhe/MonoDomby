"use strict";
// =============================================================================
// tests/unit/engine/BuyProperty.test.ts
// Exhaustive tests for ActionType.BUY_PROPERTY action.
//
// Coverage:
//   - Successful purchase (Property, Railroad, Utility)
//   - Bank transactions and property inventory updates
//   - TileState ownership changes
//   - Monopoly completion detection (MONOPOLY_COMPLETED event)
//   - Validation: insufficient funds, already owned, wrong phase, wrong player
//   - Immutability and replay determinism
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const GameEngine_js_1 = require("../../../src/engine/GameEngine.js");
const shared_1 = require("@monopoly/shared");
// ---------------------------------------------------------------------------
// Test map
// ---------------------------------------------------------------------------
function createBuyPropertyTestMap() {
    return {
        schemaVersion: '1.0',
        meta: {
            id: 'buy-property-test-map',
            name: 'Buy Property Test Map',
            playerTokens: [
                { id: 'token-1', name: 'Token 1', iconUrl: '' },
                { id: 'token-2', name: 'Token 2', iconUrl: '' },
            ],
        },
        bank: {
            startingMoney: 1500,
            infiniteMoney: true,
            initialHouses: 32,
            initialHotels: 12,
            goReward: 200,
        },
        board: {
            size: 5,
            jailTileIndex: 1,
            tiles: [
                { id: 'go', index: 0, type: shared_1.TileType.GO, name: 'GO' },
                {
                    id: 'prop-1',
                    index: 1,
                    type: shared_1.TileType.PROPERTY,
                    name: 'Prop 1',
                    propertyData: {
                        groupId: 'group-a',
                        price: 100,
                        rents: { base: 10, colorGroup: 20, oneHouse: 30, twoHouses: 40, threeHouses: 50, fourHouses: 60, hotel: 70 },
                        houseCost: 50,
                        hotelCost: 50,
                        mortgageValue: 50,
                        unmortgageCost: 55,
                    },
                },
                {
                    id: 'prop-2',
                    index: 2,
                    type: shared_1.TileType.PROPERTY,
                    name: 'Prop 2',
                    propertyData: {
                        groupId: 'group-a',
                        price: 150,
                        rents: { base: 10, colorGroup: 20, oneHouse: 30, twoHouses: 40, threeHouses: 50, fourHouses: 60, hotel: 70 },
                        houseCost: 50,
                        hotelCost: 50,
                        mortgageValue: 75,
                        unmortgageCost: 83,
                    },
                },
                {
                    id: 'railroad',
                    index: 3,
                    type: shared_1.TileType.RAILROAD,
                    name: 'Railroad',
                    railroadData: {
                        price: 200,
                        rents: [25, 50, 100, 200],
                        mortgageValue: 100,
                        unmortgageCost: 110,
                    },
                },
                {
                    id: 'utility',
                    index: 4,
                    type: shared_1.TileType.UTILITY,
                    name: 'Utility',
                    utilityData: {
                        price: 150,
                        diceMultipliers: [4, 10],
                        mortgageValue: 75,
                        unmortgageCost: 83,
                    },
                },
            ],
            propertyGroups: [
                { id: 'group-a', name: 'Group A', color: '#ff0000', tileIds: ['prop-1', 'prop-2'] },
            ],
        },
        cards: {
            chance: [],
            communityChest: [],
        },
        rules: {
            auctionOnDecline: true,
            evenBuildingRequired: true,
            maxTurnsInJail: 3,
            jailFine: 50,
            doublesForJailRelease: true,
            freeParkingMoney: false,
            bankruptcyToBank: false,
            winCondition: shared_1.WinCondition.LAST_STANDING,
            auctionConfig: { durationSeconds: 30, extensionSeconds: 10, extensionThreshold: 5, minBidIncrement: 10, maxExtensions: 10 },
        },
    };
}
// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------
const PLAYER_1 = 'player-1';
const PLAYER_2 = 'player-2';
function buyAction(overrides) {
    return {
        actionId: 'action-buy-123',
        type: shared_1.ActionType.BUY_PROPERTY,
        roomId: 'room-1',
        clientTs: 100000,
        payload: {},
        ...overrides,
    };
}
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
(0, vitest_1.describe)('BUY_PROPERTY action', () => {
    let engine;
    let mapConfig;
    let initialState;
    (0, vitest_1.beforeEach)(() => {
        mapConfig = createBuyPropertyTestMap();
        engine = new GameEngine_js_1.GameEngine();
        const createParams = {
            gameId: 'game-1',
            roomId: 'room-1',
            mapConfig,
            players: [
                { userId: 'u1', playerId: PLAYER_1, displayName: 'P1', avatarUrl: '', tokenId: 'token-1' },
                { userId: 'u2', playerId: PLAYER_2, displayName: 'P2', avatarUrl: '', tokenId: 'token-2' },
            ],
            rngSeed: 'seed-123',
            createdAt: 10000,
        };
        const { newState } = GameEngine_js_1.GameEngine.createInitialState(createParams);
        // Put game in PURCHASE_DECISION phase for PLAYER_1 on prop-1
        initialState = {
            ...newState,
            gamePhase: shared_1.GamePhase.IN_PROGRESS,
            turn: {
                ...newState.turn,
                currentPlayerId: PLAYER_1,
                phase: shared_1.TurnPhase.PURCHASE_DECISION,
                pendingDecision: {
                    type: shared_1.DecisionType.PURCHASE,
                    tileId: 'prop-1',
                },
            },
        };
    });
    // ==========================================================================
    //  Successful Purchases
    // ==========================================================================
    (0, vitest_1.describe)('Successful purchase (Property)', () => {
        (0, vitest_1.it)('deducts the correct price from the player', () => {
            const p1MoneyBefore = initialState.players[PLAYER_1].money;
            const { newState } = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(newState.players[PLAYER_1].money).toBe(p1MoneyBefore - 100);
        });
        (0, vitest_1.it)('transfers the purchase price to the bank', () => {
            const bankMoneyBefore = initialState.bank.money;
            // Note: with infiniteMoney=true, bank.money doesn't strictly matter for mechanics,
            // but ActionProcessor still updates the counter. Wait, the handler sets it back
            // if infiniteMoney is true.
            // Let's modify state to have infiniteMoney=false to test this.
            const state = { ...initialState, bank: { ...initialState.bank, infiniteMoney: false, money: 10000 } };
            const { newState } = engine.apply(state, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(newState.bank.money).toBe(10000 + 100);
        });
        (0, vitest_1.it)('adds the tileId to the player\'s properties array', () => {
            const { newState } = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(newState.players[PLAYER_1].properties).toContain('prop-1');
        });
        (0, vitest_1.it)('sets the TileState ownerId to the purchasing player', () => {
            const { newState } = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(newState.board.tiles['prop-1'].ownerId).toBe(PLAYER_1);
        });
        (0, vitest_1.it)('transitions turn phase to POST_ROLL', () => {
            const { newState } = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
        });
        (0, vitest_1.it)('clears the pendingDecision', () => {
            const { newState } = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(newState.turn.pendingDecision).toBeNull();
        });
        (0, vitest_1.it)('emits a PROPERTY_PURCHASED event with correct payload', () => {
            const action = buyAction();
            const { events } = engine.apply(initialState, action, mapConfig, PLAYER_1);
            (0, vitest_1.expect)(events).toHaveLength(1);
            const ev = events[0];
            (0, vitest_1.expect)(ev.type).toBe(shared_1.EventType.PROPERTY_PURCHASED);
            (0, vitest_1.expect)(ev.id).toBe(`${action.actionId}::PROPERTY_PURCHASED`);
            const payload = ev.payload;
            (0, vitest_1.expect)(payload.playerId).toBe(PLAYER_1);
            (0, vitest_1.expect)(payload.tileId).toBe('prop-1');
            (0, vitest_1.expect)(payload.price).toBe(100);
        });
    });
    (0, vitest_1.describe)('Successful purchase (Railroad)', () => {
        let rrState;
        (0, vitest_1.beforeEach)(() => {
            rrState = {
                ...initialState,
                turn: {
                    ...initialState.turn,
                    pendingDecision: { type: shared_1.DecisionType.PURCHASE, tileId: 'railroad' },
                },
            };
        });
        (0, vitest_1.it)('deducts the correct price from the player', () => {
            const p1MoneyBefore = rrState.players[PLAYER_1].money;
            const { newState } = engine.apply(rrState, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(newState.players[PLAYER_1].money).toBe(p1MoneyBefore - 200);
        });
        (0, vitest_1.it)('updates TileState ownership correctly', () => {
            const { newState } = engine.apply(rrState, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(newState.board.tiles['railroad'].ownerId).toBe(PLAYER_1);
        });
    });
    (0, vitest_1.describe)('Successful purchase (Utility)', () => {
        let utState;
        (0, vitest_1.beforeEach)(() => {
            utState = {
                ...initialState,
                turn: {
                    ...initialState.turn,
                    pendingDecision: { type: shared_1.DecisionType.PURCHASE, tileId: 'utility' },
                },
            };
        });
        (0, vitest_1.it)('deducts the correct price from the player', () => {
            const p1MoneyBefore = utState.players[PLAYER_1].money;
            const { newState } = engine.apply(utState, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(newState.players[PLAYER_1].money).toBe(p1MoneyBefore - 150);
        });
        (0, vitest_1.it)('updates TileState ownership correctly', () => {
            const { newState } = engine.apply(utState, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(newState.board.tiles['utility'].ownerId).toBe(PLAYER_1);
        });
    });
    // ==========================================================================
    //  Monopoly Completion
    // ==========================================================================
    (0, vitest_1.describe)('Monopoly Completion', () => {
        let almostMonopolyState;
        (0, vitest_1.beforeEach)(() => {
            // P1 already owns prop-1, is deciding to buy prop-2
            almostMonopolyState = {
                ...initialState,
                players: {
                    ...initialState.players,
                    [PLAYER_1]: {
                        ...initialState.players[PLAYER_1],
                        properties: ['prop-1'],
                    },
                },
                board: {
                    ...initialState.board,
                    tiles: {
                        ...initialState.board.tiles,
                        'prop-1': { ...initialState.board.tiles['prop-1'], ownerId: PLAYER_1 },
                    },
                },
                turn: {
                    ...initialState.turn,
                    pendingDecision: { type: shared_1.DecisionType.PURCHASE, tileId: 'prop-2' },
                },
            };
        });
        (0, vitest_1.it)('emits MONOPOLY_COMPLETED event when purchasing the final group property', () => {
            const action = buyAction();
            const { events } = engine.apply(almostMonopolyState, action, mapConfig, PLAYER_1);
            (0, vitest_1.expect)(events).toHaveLength(2); // PURCHASED and MONOPOLY_COMPLETED
            (0, vitest_1.expect)(events[0].type).toBe(shared_1.EventType.PROPERTY_PURCHASED);
            (0, vitest_1.expect)(events[1].type).toBe(shared_1.EventType.MONOPOLY_COMPLETED);
            const mcEvent = events[1];
            (0, vitest_1.expect)(mcEvent.id).toBe(`${action.actionId}::MONOPOLY_COMPLETED`);
            const payload = mcEvent.payload;
            (0, vitest_1.expect)(payload.playerId).toBe(PLAYER_1);
            (0, vitest_1.expect)(payload.groupId).toBe('group-a');
        });
        (0, vitest_1.it)('does NOT emit MONOPOLY_COMPLETED when buying a utility (no group id)', () => {
            const utState = {
                ...almostMonopolyState,
                turn: {
                    ...almostMonopolyState.turn,
                    pendingDecision: { type: shared_1.DecisionType.PURCHASE, tileId: 'utility' },
                },
            };
            const { events } = engine.apply(utState, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(events).toHaveLength(1);
            (0, vitest_1.expect)(events[0].type).toBe(shared_1.EventType.PROPERTY_PURCHASED);
        });
    });
    // ==========================================================================
    //  Validation Failures
    // ==========================================================================
    (0, vitest_1.describe)('Validation Failures', () => {
        (0, vitest_1.it)('returns an error if it is not the active player', () => {
            // P1's turn, P2 tries to buy
            const result = engine.validate(initialState, buyAction(), mapConfig, PLAYER_2);
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.code).toBe(shared_1.ErrorCode.E_NOT_YOUR_TURN);
        });
        (0, vitest_1.it)('returns an error if the phase is not PURCHASE_DECISION', () => {
            const state = {
                ...initialState,
                turn: { ...initialState.turn, phase: shared_1.TurnPhase.POST_ROLL },
            };
            const result = engine.validate(state, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.code).toBe(shared_1.ErrorCode.E_INVALID_PHASE);
        });
        (0, vitest_1.it)('returns an error if there is no pendingDecision', () => {
            const state = {
                ...initialState,
                turn: { ...initialState.turn, pendingDecision: null },
            };
            const result = engine.validate(state, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.code).toBe(shared_1.ErrorCode.E_INVALID_PHASE);
        });
        (0, vitest_1.it)('returns an error if pendingDecision is not PURCHASE', () => {
            const state = {
                ...initialState,
                turn: {
                    ...initialState.turn,
                    pendingDecision: { type: shared_1.DecisionType.JAIL, tileId: 'prop-1' },
                },
            };
            const result = engine.validate(state, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.code).toBe(shared_1.ErrorCode.E_INVALID_PHASE);
        });
        (0, vitest_1.it)('returns an error if property is already owned', () => {
            const state = {
                ...initialState,
                board: {
                    ...initialState.board,
                    tiles: {
                        ...initialState.board.tiles,
                        'prop-1': { ...initialState.board.tiles['prop-1'], ownerId: PLAYER_2 },
                    },
                },
            };
            const result = engine.validate(state, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.code).toBe(shared_1.ErrorCode.E_PROPERTY_OWNED);
        });
        (0, vitest_1.it)('returns an error if player has insufficient funds', () => {
            const state = {
                ...initialState,
                players: {
                    ...initialState.players,
                    [PLAYER_1]: { ...initialState.players[PLAYER_1], money: 50 }, // prop-1 costs 100
                },
            };
            const result = engine.validate(state, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.code).toBe(shared_1.ErrorCode.E_DEBT_RECOVERY);
        });
    });
    // ==========================================================================
    //  Immutability & Determinism
    // ==========================================================================
    (0, vitest_1.describe)('Immutability and Determinism', () => {
        (0, vitest_1.it)('does not mutate the input state', () => {
            const stateJSON = JSON.stringify(initialState);
            engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(JSON.stringify(initialState)).toBe(stateJSON);
        });
        (0, vitest_1.it)('returns a new object reference', () => {
            const { newState } = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(newState).not.toBe(initialState);
            (0, vitest_1.expect)(newState.players).not.toBe(initialState.players);
            (0, vitest_1.expect)(newState.board).not.toBe(initialState.board);
            (0, vitest_1.expect)(newState.turn).not.toBe(initialState.turn);
        });
        (0, vitest_1.it)('increments version exactly by 1', () => {
            const { newState } = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(newState.version).toBe(initialState.version + 1);
        });
        (0, vitest_1.it)('replay determinism: identical initial state + action = identical result', () => {
            const res1 = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
            const res2 = engine.apply(initialState, buyAction(), mapConfig, PLAYER_1);
            (0, vitest_1.expect)(JSON.stringify(res1)).toEqual(JSON.stringify(res2));
        });
    });
});
//# sourceMappingURL=BuyProperty.test.js.map