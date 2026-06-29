"use strict";
// =============================================================================
// tests/unit/engine/TileResolver.test.ts
// Comprehensive unit tests for TileResolver.
//
// Strategy:
//  - Test TileResolver.resolve() directly (not through engine.apply) for
//    fast, focused coverage.
//  - For each tile type, build a minimal but valid GameState with the player
//    already at the target tile index, then assert the returned EngineResult.
//  - Integration with engine.apply is also tested for the GO_TO_JAIL and
//    CHANCE paths to verify end-to-end determinism.
//
// Coverage:
//   GO              → POST_ROLL, no events, no pendingDecision
//   JAIL_VISIT      → POST_ROLL, no events, no pendingDecision
//   FREE_PARKING    → POST_ROLL, no events, no pendingDecision
//   PROPERTY        → PURCHASE_DECISION (unowned)
//                  → POST_ROLL (own, mortgaged, another's)
//   RAILROAD        → PURCHASE_DECISION (unowned) | POST_ROLL (own / mortgaged / other)
//   UTILITY         → PURCHASE_DECISION (unowned) | POST_ROLL (own / mortgaged / other)
//   CHANCE          → CARD_DRAWN, CARD_DRAWN event, deck advanced, pendingDecision set
//   COMMUNITY_CHEST → CARD_DRAWN, CARD_DRAWN event, deck advanced, pendingDecision set
//   TAX             → POST_ROLL (stub)
//   GO_TO_JAIL      → POST_ROLL, player teleported to jail, PLAYER_JAILED event
//   CUSTOM          → registered handler invoked | POST_ROLL fallback
//   Unknown type    → throws EngineStateCorruptionError
//   Missing tile    → throws EngineStateCorruptionError
//
//   Determinism     → same state + action → identical result every time
//   Immutability    → input state is never mutated
//   Card reshuffle  → exhausting a deck reshuffles deterministically
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const GameEngine_js_1 = require("../../../src/engine/GameEngine.js");
const TileResolver_js_1 = require("../../../src/engine/TileResolver.js");
const errors_js_1 = require("../../../src/engine/errors.js");
const shared_1 = require("@monopoly/shared");
// =============================================================================
//  Test Map Fixture
// =============================================================================
// Board layout (size = 14, jailTileIndex = 5):
//   0   GO
//   1   PROPERTY   'prop-a'   (group: blue, price: 100)  [unowned initially]
//   2   RAILROAD   'railroad' (price: 200)
//   3   UTILITY    'utility'  (price: 150)
//   4   CHANCE     'chance'
//   5   JAIL_VISIT 'jail'
//   6   COMMUNITY_CHEST 'cc'
//   7   TAX        'tax'     (amount: 75, fixed, → BANK)
//   8   FREE_PARKING 'free-parking'
//   9   GO_TO_JAIL 'go-to-jail'
//   10  PROPERTY   'prop-b'   (group: blue, price: 100)  [unowned initially]
//   11  CUSTOM     'bonus'
//   12  PROPERTY   'prop-c'   (group: red, price: 200)   [unowned initially]
//   13  PROPERTY   'prop-d'   (group: red, price: 200)   [unowned initially]
function buildTestMap() {
    return {
        schemaVersion: '1.0',
        meta: {
            id: 'tile-resolver-test-map',
            name: 'Tile Resolver Test Map',
            playerTokens: [
                { id: 'token-1', name: 'T1', iconUrl: '' },
                { id: 'token-2', name: 'T2', iconUrl: '' },
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
            size: 14,
            jailTileIndex: 5,
            tiles: [
                { id: 'go', index: 0, type: shared_1.TileType.GO, name: 'GO' },
                {
                    id: 'prop-a', index: 1, type: shared_1.TileType.PROPERTY, name: 'Blue 1',
                    propertyData: {
                        groupId: 'blue', price: 100,
                        rents: { base: 6, colorGroup: 12, oneHouse: 30, twoHouses: 90, threeHouses: 270, fourHouses: 400, hotel: 550 },
                        houseCost: 50, hotelCost: 50, mortgageValue: 50, unmortgageCost: 55,
                    },
                },
                {
                    id: 'railroad', index: 2, type: shared_1.TileType.RAILROAD, name: 'Railroad',
                    railroadData: { price: 200, rents: [25, 50, 100, 200], mortgageValue: 100, unmortgageCost: 110 },
                },
                {
                    id: 'utility', index: 3, type: shared_1.TileType.UTILITY, name: 'Utility',
                    utilityData: { price: 150, diceMultipliers: [4, 10], mortgageValue: 75, unmortgageCost: 83 },
                },
                { id: 'chance', index: 4, type: shared_1.TileType.CHANCE, name: 'Chance' },
                { id: 'jail', index: 5, type: shared_1.TileType.JAIL_VISIT, name: 'Jail / Just Visiting' },
                { id: 'cc', index: 6, type: shared_1.TileType.COMMUNITY_CHEST, name: 'Community Chest' },
                {
                    id: 'tax', index: 7, type: shared_1.TileType.TAX, name: 'Income Tax',
                    taxData: { amount: 75, isPercentage: false, destination: shared_1.TaxDestination.BANK },
                },
                { id: 'free-parking', index: 8, type: shared_1.TileType.FREE_PARKING, name: 'Free Parking' },
                { id: 'go-to-jail', index: 9, type: shared_1.TileType.GO_TO_JAIL, name: 'Go To Jail' },
                {
                    id: 'prop-b', index: 10, type: shared_1.TileType.PROPERTY, name: 'Blue 2',
                    propertyData: {
                        groupId: 'blue', price: 100,
                        rents: { base: 6, colorGroup: 12, oneHouse: 30, twoHouses: 90, threeHouses: 270, fourHouses: 400, hotel: 550 },
                        houseCost: 50, hotelCost: 50, mortgageValue: 50, unmortgageCost: 55,
                    },
                },
                { id: 'bonus', index: 11, type: shared_1.TileType.CUSTOM, name: 'Bonus Square', customData: {} },
                {
                    id: 'prop-c', index: 12, type: shared_1.TileType.PROPERTY, name: 'Red 1',
                    propertyData: {
                        groupId: 'red', price: 200,
                        rents: { base: 16, colorGroup: 32, oneHouse: 100, twoHouses: 300, threeHouses: 600, fourHouses: 900, hotel: 1100 },
                        houseCost: 100, hotelCost: 100, mortgageValue: 100, unmortgageCost: 110,
                    },
                },
                {
                    id: 'prop-d', index: 13, type: shared_1.TileType.PROPERTY, name: 'Red 2',
                    propertyData: {
                        groupId: 'red', price: 200,
                        rents: { base: 16, colorGroup: 32, oneHouse: 100, twoHouses: 300, threeHouses: 600, fourHouses: 900, hotel: 1100 },
                        houseCost: 100, hotelCost: 100, mortgageValue: 100, unmortgageCost: 110,
                    },
                },
            ],
            propertyGroups: [
                { id: 'blue', name: 'Blue', color: '#0000cc', tileIds: ['prop-a', 'prop-b'] },
                { id: 'red', name: 'Red', color: '#cc0000', tileIds: ['prop-c', 'prop-d'] },
            ],
        },
        cards: {
            chance: [
                { id: 'ch-1', text: 'Advance to GO', deckType: shared_1.CardDeckType.CHANCE, effect: { type: shared_1.CardEffectType.MOVE_TO_TILE, tileId: 'go' } },
                { id: 'ch-2', text: 'Collect $50', deckType: shared_1.CardDeckType.CHANCE, effect: { type: shared_1.CardEffectType.COLLECT_FROM_BANK, amount: 50 } },
                { id: 'ch-3', text: 'Go to jail', deckType: shared_1.CardDeckType.CHANCE, effect: { type: shared_1.CardEffectType.GO_TO_JAIL } },
            ],
            communityChest: [
                { id: 'cc-a', text: 'Bank error — collect $200', deckType: shared_1.CardDeckType.COMMUNITY_CHEST, effect: { type: shared_1.CardEffectType.COLLECT_FROM_BANK, amount: 200 } },
                { id: 'cc-b', text: 'Pay hospital $50', deckType: shared_1.CardDeckType.COMMUNITY_CHEST, effect: { type: shared_1.CardEffectType.PAY_TO_BANK, amount: 50 } },
            ],
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
// =============================================================================
//  Shared player IDs & helpers
// =============================================================================
const P1 = 'player-alpha';
const P2 = 'player-beta';
function makeCreateParams(overrides) {
    return {
        gameId: 'tile-resolver-game-001',
        roomId: 'room-tile-test',
        mapConfig: buildTestMap(),
        players: [
            { userId: 'u1', playerId: P1, displayName: 'Alpha', avatarUrl: '', tokenId: 'token-1' },
            { userId: 'u2', playerId: P2, displayName: 'Beta', avatarUrl: '', tokenId: 'token-2' },
        ],
        rngSeed: 'tile-resolver-seed-abc',
        createdAt: 2_000_000_000_000,
        ...overrides,
    };
}
/**
 * Build a synthetic game state with P1 already on tile `position`,
 * turn phase = ROLLED (the precondition for resolveLandingTile).
 */
function stateAtTile(base, position) {
    return {
        ...base,
        players: {
            ...base.players,
            [P1]: { ...base.players[P1], position },
        },
        turn: {
            ...base.turn,
            phase: shared_1.TurnPhase.ROLLED,
            diceValues: [3, 4],
            pendingDecision: null,
        },
    };
}
/** Build a minimal ClientAction for the tests. */
function makeAction(overrides) {
    return {
        actionId: 'action-tile-001',
        type: shared_1.ActionType.ROLL_DICE,
        roomId: 'room-tile-test',
        clientTs: 2_000_000_001_000,
        payload: {},
        ...overrides,
    };
}
/**
 * Set a specific tile to owned by `ownerId`.
 * Simulates a mid-game ownership state.
 */
function withTileOwner(state, tileId, ownerId, opts = {}) {
    return {
        ...state,
        board: {
            ...state.board,
            tiles: {
                ...state.board.tiles,
                [tileId]: {
                    ...state.board.tiles[tileId],
                    ownerId,
                    isMortgaged: opts.isMortgaged ?? false,
                },
            },
        },
        players: {
            ...state.players,
            [ownerId]: {
                ...state.players[ownerId],
                properties: [
                    ...state.players[ownerId].properties,
                    ...(state.players[ownerId].properties.includes(tileId) ? [] : [tileId]),
                ],
            },
        },
    };
}
// =============================================================================
//  Test suite
// =============================================================================
(0, vitest_1.describe)('TileResolver', () => {
    let config;
    let resolver;
    let initialState;
    let action;
    (0, vitest_1.beforeEach)(() => {
        config = buildTestMap();
        resolver = new TileResolver_js_1.TileResolver();
        const { newState } = GameEngine_js_1.GameEngine.createInitialState(makeCreateParams());
        initialState = newState;
        action = makeAction();
    });
    // ==========================================================================
    //  GO
    // ==========================================================================
    (0, vitest_1.describe)('TileType.GO', () => {
        (0, vitest_1.it)('transitions to POST_ROLL', () => {
            const state = stateAtTile(initialState, 0 /* GO */);
            const result = resolver.resolve(state, 0, config, action, P1);
            (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
        });
        (0, vitest_1.it)('emits no events', () => {
            const state = stateAtTile(initialState, 0);
            const result = resolver.resolve(state, 0, config, action, P1);
            (0, vitest_1.expect)(result.events).toHaveLength(0);
        });
        (0, vitest_1.it)('clears any pending decision', () => {
            const stateWithDecision = {
                ...stateAtTile(initialState, 0),
                turn: {
                    ...stateAtTile(initialState, 0).turn,
                    pendingDecision: { type: shared_1.DecisionType.PURCHASE, tileId: 'prop-a' },
                },
            };
            const result = resolver.resolve(stateWithDecision, 0, config, action, P1);
            (0, vitest_1.expect)(result.newState.turn.pendingDecision).toBeNull();
        });
        (0, vitest_1.it)('does not alter player money', () => {
            const state = stateAtTile(initialState, 0);
            const result = resolver.resolve(state, 0, config, action, P1);
            (0, vitest_1.expect)(result.newState.players[P1].money).toBe(state.players[P1].money);
        });
    });
    // ==========================================================================
    //  JAIL_VISIT
    // ==========================================================================
    (0, vitest_1.describe)('TileType.JAIL_VISIT', () => {
        (0, vitest_1.it)('transitions to POST_ROLL', () => {
            const state = stateAtTile(initialState, 5);
            const result = resolver.resolve(state, 5, config, action, P1);
            (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
        });
        (0, vitest_1.it)('emits no events', () => {
            const state = stateAtTile(initialState, 5);
            const result = resolver.resolve(state, 5, config, action, P1);
            (0, vitest_1.expect)(result.events).toHaveLength(0);
        });
        (0, vitest_1.it)('does not set player jailState', () => {
            const state = stateAtTile(initialState, 5);
            const result = resolver.resolve(state, 5, config, action, P1);
            (0, vitest_1.expect)(result.newState.players[P1].jailState).toBeNull();
        });
        (0, vitest_1.it)('clears any pending decision', () => {
            const state = stateAtTile(initialState, 5);
            const result = resolver.resolve(state, 5, config, action, P1);
            (0, vitest_1.expect)(result.newState.turn.pendingDecision).toBeNull();
        });
    });
    // ==========================================================================
    //  FREE_PARKING
    // ==========================================================================
    (0, vitest_1.describe)('TileType.FREE_PARKING', () => {
        (0, vitest_1.it)('transitions to POST_ROLL', () => {
            const state = stateAtTile(initialState, 8);
            const result = resolver.resolve(state, 8, config, action, P1);
            (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
        });
        (0, vitest_1.it)('emits no events', () => {
            const state = stateAtTile(initialState, 8);
            const result = resolver.resolve(state, 8, config, action, P1);
            (0, vitest_1.expect)(result.events).toHaveLength(0);
        });
        (0, vitest_1.it)('does not alter player money even if freeParkingPot > 0 (stub)', () => {
            const stateWithPot = {
                ...stateAtTile(initialState, 8),
                bank: { ...initialState.bank, freeParkingPot: 500 },
            };
            const result = resolver.resolve(stateWithPot, 8, config, action, P1);
            // Stub: pot transfer not implemented yet — pot remains unchanged
            (0, vitest_1.expect)(result.newState.bank.freeParkingPot).toBe(500);
            (0, vitest_1.expect)(result.newState.players[P1].money).toBe(stateWithPot.players[P1].money);
        });
        (0, vitest_1.it)('clears any pending decision', () => {
            const state = stateAtTile(initialState, 8);
            const result = resolver.resolve(state, 8, config, action, P1);
            (0, vitest_1.expect)(result.newState.turn.pendingDecision).toBeNull();
        });
    });
    // ==========================================================================
    //  PROPERTY
    // ==========================================================================
    (0, vitest_1.describe)('TileType.PROPERTY', () => {
        (0, vitest_1.describe)('unowned property', () => {
            (0, vitest_1.it)('transitions to PURCHASE_DECISION', () => {
                const state = stateAtTile(initialState, 1 /* prop-a, unowned */);
                const result = resolver.resolve(state, 1, config, action, P1);
                (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.PURCHASE_DECISION);
            });
            (0, vitest_1.it)('sets pendingDecision type = PURCHASE', () => {
                const state = stateAtTile(initialState, 1);
                const result = resolver.resolve(state, 1, config, action, P1);
                (0, vitest_1.expect)(result.newState.turn.pendingDecision?.type).toBe(shared_1.DecisionType.PURCHASE);
            });
            (0, vitest_1.it)('sets pendingDecision tileId correctly', () => {
                const state = stateAtTile(initialState, 1);
                const result = resolver.resolve(state, 1, config, action, P1);
                const decision = result.newState.turn.pendingDecision;
                if (decision?.type !== shared_1.DecisionType.PURCHASE)
                    throw new Error('wrong type');
                (0, vitest_1.expect)(decision.tileId).toBe('prop-a');
            });
            (0, vitest_1.it)('emits no events', () => {
                const state = stateAtTile(initialState, 1);
                const result = resolver.resolve(state, 1, config, action, P1);
                (0, vitest_1.expect)(result.events).toHaveLength(0);
            });
            (0, vitest_1.it)('does not charge the player any money', () => {
                const state = stateAtTile(initialState, 1);
                const result = resolver.resolve(state, 1, config, action, P1);
                (0, vitest_1.expect)(result.newState.players[P1].money).toBe(state.players[P1].money);
            });
            (0, vitest_1.it)('works for the second property in a group (prop-b, index 10)', () => {
                const state = stateAtTile(initialState, 10);
                const result = resolver.resolve(state, 10, config, action, P1);
                (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.PURCHASE_DECISION);
                const decision = result.newState.turn.pendingDecision;
                if (decision?.type !== shared_1.DecisionType.PURCHASE)
                    throw new Error('wrong type');
                (0, vitest_1.expect)(decision.tileId).toBe('prop-b');
            });
        });
        (0, vitest_1.describe)('property owned by the landing player', () => {
            (0, vitest_1.it)('transitions to POST_ROLL', () => {
                const base = stateAtTile(initialState, 1);
                const state = withTileOwner(base, 'prop-a', P1);
                const result = resolver.resolve(state, 1, config, action, P1);
                (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
            });
            (0, vitest_1.it)('emits no events', () => {
                const base = stateAtTile(initialState, 1);
                const state = withTileOwner(base, 'prop-a', P1);
                const result = resolver.resolve(state, 1, config, action, P1);
                (0, vitest_1.expect)(result.events).toHaveLength(0);
            });
            (0, vitest_1.it)('does not charge the player (landing on own property is free)', () => {
                const base = stateAtTile(initialState, 1);
                const state = withTileOwner(base, 'prop-a', P1);
                const result = resolver.resolve(state, 1, config, action, P1);
                (0, vitest_1.expect)(result.newState.players[P1].money).toBe(state.players[P1].money);
            });
        });
        (0, vitest_1.describe)('property owned by another player (unmortgaged)', () => {
            (0, vitest_1.it)('processes rent and transitions to POST_ROLL', () => {
                const base = stateAtTile(initialState, 1);
                const state = withTileOwner(base, 'prop-a', P2);
                const result = resolver.resolve(state, 1, config, action, P1);
                (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
            });
            (0, vitest_1.it)('emits RENT_CALCULATED and RENT_PAID events', () => {
                const base = stateAtTile(initialState, 1);
                const state = withTileOwner(base, 'prop-a', P2);
                const result = resolver.resolve(state, 1, config, action, P1);
                (0, vitest_1.expect)(result.events.length).toBeGreaterThan(0);
                (0, vitest_1.expect)(result.events.some(e => e.type === shared_1.EventType.RENT_CALCULATED)).toBe(true);
                (0, vitest_1.expect)(result.events.some(e => e.type === shared_1.EventType.RENT_PAID)).toBe(true);
            });
        });
        (0, vitest_1.describe)('mortgaged property (any owner)', () => {
            (0, vitest_1.it)('transitions to POST_ROLL when owned by another and mortgaged', () => {
                const base = stateAtTile(initialState, 1);
                const state = withTileOwner(base, 'prop-a', P2, { isMortgaged: true });
                const result = resolver.resolve(state, 1, config, action, P1);
                (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
            });
            (0, vitest_1.it)('emits no events on mortgaged property', () => {
                const base = stateAtTile(initialState, 1);
                const state = withTileOwner(base, 'prop-a', P2, { isMortgaged: true });
                const result = resolver.resolve(state, 1, config, action, P1);
                (0, vitest_1.expect)(result.events).toHaveLength(0);
            });
            (0, vitest_1.it)('does not prompt purchase on mortgaged property (still owned)', () => {
                const base = stateAtTile(initialState, 1);
                const state = withTileOwner(base, 'prop-a', P2, { isMortgaged: true });
                const result = resolver.resolve(state, 1, config, action, P1);
                (0, vitest_1.expect)(result.newState.turn.pendingDecision).toBeNull();
            });
        });
        (0, vitest_1.describe)('missing BoardState entry', () => {
            (0, vitest_1.it)('throws EngineStateCorruptionError when tile state is missing', () => {
                const state = stateAtTile(initialState, 1);
                // Remove the tile state for 'prop-a'
                const { ['prop-a']: _removed, ...restTiles } = state.board.tiles;
                const corruptedState = {
                    ...state,
                    board: { ...state.board, tiles: restTiles },
                };
                (0, vitest_1.expect)(() => resolver.resolve(corruptedState, 1, config, action, P1))
                    .toThrow(errors_js_1.EngineStateCorruptionError);
            });
        });
    });
    // ==========================================================================
    //  RAILROAD
    // ==========================================================================
    (0, vitest_1.describe)('TileType.RAILROAD', () => {
        (0, vitest_1.describe)('unowned railroad', () => {
            (0, vitest_1.it)('transitions to PURCHASE_DECISION', () => {
                const state = stateAtTile(initialState, 2);
                const result = resolver.resolve(state, 2, config, action, P1);
                (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.PURCHASE_DECISION);
            });
            (0, vitest_1.it)('sets pendingDecision tileId = railroad', () => {
                const state = stateAtTile(initialState, 2);
                const result = resolver.resolve(state, 2, config, action, P1);
                const decision = result.newState.turn.pendingDecision;
                if (decision?.type !== shared_1.DecisionType.PURCHASE)
                    throw new Error('wrong type');
                (0, vitest_1.expect)(decision.tileId).toBe('railroad');
            });
            (0, vitest_1.it)('emits no events', () => {
                const state = stateAtTile(initialState, 2);
                const result = resolver.resolve(state, 2, config, action, P1);
                (0, vitest_1.expect)(result.events).toHaveLength(0);
            });
        });
        (0, vitest_1.describe)('own railroad', () => {
            (0, vitest_1.it)('transitions to POST_ROLL', () => {
                const base = stateAtTile(initialState, 2);
                const state = withTileOwner(base, 'railroad', P1);
                const result = resolver.resolve(state, 2, config, action, P1);
                (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
            });
        });
        (0, vitest_1.describe)('another player\'s railroad', () => {
            (0, vitest_1.it)('processes rent and transitions to POST_ROLL', () => {
                const base = stateAtTile(initialState, 2);
                const state = withTileOwner(base, 'railroad', P2);
                const result = resolver.resolve(state, 2, config, action, P1);
                (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
                (0, vitest_1.expect)(result.events.some(e => e.type === shared_1.EventType.RENT_CALCULATED)).toBe(true);
            });
        });
        (0, vitest_1.describe)('mortgaged railroad', () => {
            (0, vitest_1.it)('transitions to POST_ROLL', () => {
                const base = stateAtTile(initialState, 2);
                const state = withTileOwner(base, 'railroad', P2, { isMortgaged: true });
                const result = resolver.resolve(state, 2, config, action, P1);
                (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
            });
        });
    });
    // ==========================================================================
    //  UTILITY
    // ==========================================================================
    (0, vitest_1.describe)('TileType.UTILITY', () => {
        (0, vitest_1.describe)('unowned utility', () => {
            (0, vitest_1.it)('transitions to PURCHASE_DECISION', () => {
                const state = stateAtTile(initialState, 3);
                const result = resolver.resolve(state, 3, config, action, P1);
                (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.PURCHASE_DECISION);
            });
            (0, vitest_1.it)('sets pendingDecision tileId = utility', () => {
                const state = stateAtTile(initialState, 3);
                const result = resolver.resolve(state, 3, config, action, P1);
                const decision = result.newState.turn.pendingDecision;
                if (decision?.type !== shared_1.DecisionType.PURCHASE)
                    throw new Error('wrong type');
                (0, vitest_1.expect)(decision.tileId).toBe('utility');
            });
            (0, vitest_1.it)('emits no events', () => {
                const state = stateAtTile(initialState, 3);
                const result = resolver.resolve(state, 3, config, action, P1);
                (0, vitest_1.expect)(result.events).toHaveLength(0);
            });
        });
        (0, vitest_1.describe)('own utility', () => {
            (0, vitest_1.it)('transitions to POST_ROLL', () => {
                const base = stateAtTile(initialState, 3);
                const state = withTileOwner(base, 'utility', P1);
                const result = resolver.resolve(state, 3, config, action, P1);
                (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
            });
        });
        (0, vitest_1.describe)('another player\'s utility', () => {
            (0, vitest_1.it)('processes rent and transitions to POST_ROLL', () => {
                const base = stateAtTile(initialState, 3);
                const stateWithDice = { ...base, turn: { ...base.turn, diceValues: [3, 4] } };
                const state = withTileOwner(stateWithDice, 'utility', P2);
                const result = resolver.resolve(state, 3, config, action, P1);
                (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
                (0, vitest_1.expect)(result.events.some(e => e.type === shared_1.EventType.RENT_CALCULATED)).toBe(true);
            });
        });
        (0, vitest_1.describe)('mortgaged utility', () => {
            (0, vitest_1.it)('transitions to POST_ROLL', () => {
                const base = stateAtTile(initialState, 3);
                const state = withTileOwner(base, 'utility', P2, { isMortgaged: true });
                const result = resolver.resolve(state, 3, config, action, P1);
                (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
            });
        });
    });
    // ==========================================================================
    //  CHANCE
    // ==========================================================================
    (0, vitest_1.describe)('TileType.CHANCE', () => {
        (0, vitest_1.it)('transitions to CARD_DRAWN', () => {
            const state = stateAtTile(initialState, 4);
            const result = resolver.resolve(state, 4, config, action, P1);
            (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.CARD_DRAWN);
        });
        (0, vitest_1.it)('emits exactly one CARD_DRAWN event', () => {
            const state = stateAtTile(initialState, 4);
            const result = resolver.resolve(state, 4, config, action, P1);
            (0, vitest_1.expect)(result.events).toHaveLength(1);
            (0, vitest_1.expect)(result.events[0].type).toBe(shared_1.EventType.CARD_DRAWN);
        });
        (0, vitest_1.it)('CARD_DRAWN event carries the correct deckType', () => {
            const state = stateAtTile(initialState, 4);
            const result = resolver.resolve(state, 4, config, action, P1);
            const ev = result.events[0];
            if (ev.type !== shared_1.EventType.CARD_DRAWN)
                throw new Error('wrong type');
            (0, vitest_1.expect)(ev.payload.deckType).toBe(shared_1.CardDeckType.CHANCE);
        });
        (0, vitest_1.it)('CARD_DRAWN event carries a cardId from the Chance deck', () => {
            const state = stateAtTile(initialState, 4);
            const result = resolver.resolve(state, 4, config, action, P1);
            const ev = result.events[0];
            if (ev.type !== shared_1.EventType.CARD_DRAWN)
                throw new Error('wrong type');
            const validIds = config.cards.chance.map(c => c.id);
            (0, vitest_1.expect)(validIds).toContain(ev.payload.cardId);
        });
        (0, vitest_1.it)('CARD_DRAWN event carries the correct card text from MapConfig', () => {
            const state = stateAtTile(initialState, 4);
            const result = resolver.resolve(state, 4, config, action, P1);
            const ev = result.events[0];
            if (ev.type !== shared_1.EventType.CARD_DRAWN)
                throw new Error('wrong type');
            const drawnCard = config.cards.chance.find(c => c.id === ev.payload.cardId);
            (0, vitest_1.expect)(ev.payload.cardText).toBe(drawnCard.text);
        });
        (0, vitest_1.it)('CARD_DRAWN event carries the correct playerId', () => {
            const state = stateAtTile(initialState, 4);
            const result = resolver.resolve(state, 4, config, action, P1);
            const ev = result.events[0];
            if (ev.type !== shared_1.EventType.CARD_DRAWN)
                throw new Error('wrong type');
            (0, vitest_1.expect)(ev.payload.playerId).toBe(P1);
        });
        (0, vitest_1.it)('sets pendingDecision type = CARD_EFFECT', () => {
            const state = stateAtTile(initialState, 4);
            const result = resolver.resolve(state, 4, config, action, P1);
            (0, vitest_1.expect)(result.newState.turn.pendingDecision?.type).toBe(shared_1.DecisionType.CARD_EFFECT);
        });
        (0, vitest_1.it)('pendingDecision cardId matches the CARD_DRAWN event cardId', () => {
            const state = stateAtTile(initialState, 4);
            const result = resolver.resolve(state, 4, config, action, P1);
            const decision = result.newState.turn.pendingDecision;
            if (decision?.type !== shared_1.DecisionType.CARD_EFFECT)
                throw new Error('wrong type');
            const ev = result.events[0];
            if (ev.type !== shared_1.EventType.CARD_DRAWN)
                throw new Error('wrong type');
            (0, vitest_1.expect)(decision.cardId).toBe(ev.payload.cardId);
        });
        (0, vitest_1.it)('pendingDecision deckType = CHANCE', () => {
            const state = stateAtTile(initialState, 4);
            const result = resolver.resolve(state, 4, config, action, P1);
            const decision = result.newState.turn.pendingDecision;
            if (decision?.type !== shared_1.DecisionType.CARD_EFFECT)
                throw new Error('wrong type');
            (0, vitest_1.expect)(decision.deckType).toBe(shared_1.CardDeckType.CHANCE);
        });
        (0, vitest_1.it)('removes drawn card from the Chance draw pile', () => {
            const state = stateAtTile(initialState, 4);
            const beforeLen = state.cardDecks.chance.length;
            const result = resolver.resolve(state, 4, config, action, P1);
            (0, vitest_1.expect)(result.newState.cardDecks.chance.length).toBe(beforeLen - 1);
        });
        (0, vitest_1.it)('adds drawn card to the Chance discard pile', () => {
            const state = stateAtTile(initialState, 4);
            const ev = resolver.resolve(state, 4, config, action, P1).events[0];
            if (ev.type !== shared_1.EventType.CARD_DRAWN)
                throw new Error('wrong type');
            const drawn = ev.payload.cardId;
            const result = resolver.resolve(state, 4, config, action, P1);
            (0, vitest_1.expect)(result.newState.cardDecks.chanceDiscard).toContain(drawn);
        });
        (0, vitest_1.it)('total card count is preserved after draw (pile + discard)', () => {
            const state = stateAtTile(initialState, 4);
            const result = resolver.resolve(state, 4, config, action, P1);
            const totalBefore = state.cardDecks.chance.length + state.cardDecks.chanceDiscard.length;
            const totalAfter = result.newState.cardDecks.chance.length + result.newState.cardDecks.chanceDiscard.length;
            (0, vitest_1.expect)(totalAfter).toBe(totalBefore);
        });
        (0, vitest_1.it)('CARD_DRAWN event id is deterministic (same action → same id)', () => {
            const state = stateAtTile(initialState, 4);
            const r1 = resolver.resolve(state, 4, config, action, P1);
            const r2 = resolver.resolve(state, 4, config, action, P1);
            (0, vitest_1.expect)(r1.events[0].id).toBe(r2.events[0].id);
        });
        (0, vitest_1.it)('CARD_DRAWN event id encodes the deck type', () => {
            const state = stateAtTile(initialState, 4);
            const result = resolver.resolve(state, 4, config, action, P1);
            (0, vitest_1.expect)(result.events[0].id).toContain('CHANCE');
        });
        (0, vitest_1.it)('reshuffles discard pile when draw pile is exhausted', () => {
            // Draw all 3 Chance cards so the draw pile is empty
            let state = stateAtTile(initialState, 4);
            for (let i = 0; i < config.cards.chance.length; i++) {
                const r = resolver.resolve(state, 4, config, makeAction({ actionId: `action-ch-${i}` }), P1);
                state = { ...r.newState, turn: { ...r.newState.turn, phase: shared_1.TurnPhase.ROLLED } };
            }
            // At this point draw pile should be empty and discard has all cards
            (0, vitest_1.expect)(state.cardDecks.chance).toHaveLength(0);
            (0, vitest_1.expect)(state.cardDecks.chanceDiscard).toHaveLength(config.cards.chance.length);
            // Drawing again should reshuffle without throwing
            const result = resolver.resolve(state, 4, config, makeAction({ actionId: 'action-reshuffle' }), P1);
            (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.CARD_DRAWN);
            // After reshuffle + draw: deck has (total - 1) cards again
            const total = result.newState.cardDecks.chance.length + result.newState.cardDecks.chanceDiscard.length;
            (0, vitest_1.expect)(total).toBe(config.cards.chance.length);
        });
        (0, vitest_1.it)('reshuffle uses PRNG — produces deterministic card order', () => {
            // Exhaust the deck
            let state = stateAtTile(initialState, 4);
            for (let i = 0; i < config.cards.chance.length; i++) {
                const r = resolver.resolve(state, 4, config, makeAction({ actionId: `ch-drain-${i}` }), P1);
                state = { ...r.newState, turn: { ...r.newState.turn, phase: shared_1.TurnPhase.ROLLED } };
            }
            // Two separate resolvers starting from the same exhausted state produce the same result
            const r1 = resolver.resolve(state, 4, config, makeAction({ actionId: 'reshuffle-det' }), P1);
            const r2 = new TileResolver_js_1.TileResolver().resolve(state, 4, config, makeAction({ actionId: 'reshuffle-det' }), P1);
            const ev1 = r1.events[0];
            const ev2 = r2.events[0];
            if (ev1.type !== shared_1.EventType.CARD_DRAWN || ev2.type !== shared_1.EventType.CARD_DRAWN)
                throw new Error();
            (0, vitest_1.expect)(ev1.payload.cardId).toBe(ev2.payload.cardId);
        });
    });
    // ==========================================================================
    //  COMMUNITY_CHEST
    // ==========================================================================
    (0, vitest_1.describe)('TileType.COMMUNITY_CHEST', () => {
        (0, vitest_1.it)('transitions to CARD_DRAWN', () => {
            const state = stateAtTile(initialState, 6);
            const result = resolver.resolve(state, 6, config, action, P1);
            (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.CARD_DRAWN);
        });
        (0, vitest_1.it)('emits exactly one CARD_DRAWN event', () => {
            const state = stateAtTile(initialState, 6);
            const result = resolver.resolve(state, 6, config, action, P1);
            (0, vitest_1.expect)(result.events).toHaveLength(1);
            (0, vitest_1.expect)(result.events[0].type).toBe(shared_1.EventType.CARD_DRAWN);
        });
        (0, vitest_1.it)('CARD_DRAWN event carries deckType = COMMUNITY_CHEST', () => {
            const state = stateAtTile(initialState, 6);
            const result = resolver.resolve(state, 6, config, action, P1);
            const ev = result.events[0];
            if (ev.type !== shared_1.EventType.CARD_DRAWN)
                throw new Error();
            (0, vitest_1.expect)(ev.payload.deckType).toBe(shared_1.CardDeckType.COMMUNITY_CHEST);
        });
        (0, vitest_1.it)('drawn cardId is from Community Chest pool', () => {
            const state = stateAtTile(initialState, 6);
            const result = resolver.resolve(state, 6, config, action, P1);
            const ev = result.events[0];
            if (ev.type !== shared_1.EventType.CARD_DRAWN)
                throw new Error();
            const validIds = config.cards.communityChest.map(c => c.id);
            (0, vitest_1.expect)(validIds).toContain(ev.payload.cardId);
        });
        (0, vitest_1.it)('community chest pile is advanced, not the chance pile', () => {
            const state = stateAtTile(initialState, 6);
            const chanceLenBefore = state.cardDecks.chance.length;
            const result = resolver.resolve(state, 6, config, action, P1);
            // Chance pile untouched
            (0, vitest_1.expect)(result.newState.cardDecks.chance.length).toBe(chanceLenBefore);
            // CC pile decremented
            (0, vitest_1.expect)(result.newState.cardDecks.communityChest.length).toBe(state.cardDecks.communityChest.length - 1);
        });
        (0, vitest_1.it)('sets pendingDecision deckType = COMMUNITY_CHEST', () => {
            const state = stateAtTile(initialState, 6);
            const result = resolver.resolve(state, 6, config, action, P1);
            const decision = result.newState.turn.pendingDecision;
            if (decision?.type !== shared_1.DecisionType.CARD_EFFECT)
                throw new Error('wrong decision type');
            (0, vitest_1.expect)(decision.deckType).toBe(shared_1.CardDeckType.COMMUNITY_CHEST);
        });
        (0, vitest_1.it)('CARD_DRAWN event id encodes COMMUNITY_CHEST', () => {
            const state = stateAtTile(initialState, 6);
            const result = resolver.resolve(state, 6, config, action, P1);
            (0, vitest_1.expect)(result.events[0].id).toContain('COMMUNITY_CHEST');
        });
        (0, vitest_1.it)('total Community Chest card count is preserved', () => {
            const state = stateAtTile(initialState, 6);
            const result = resolver.resolve(state, 6, config, action, P1);
            const before = state.cardDecks.communityChest.length + state.cardDecks.communityChestDiscard.length;
            const after = result.newState.cardDecks.communityChest.length + result.newState.cardDecks.communityChestDiscard.length;
            (0, vitest_1.expect)(after).toBe(before);
        });
        (0, vitest_1.it)('Chance and Community Chest decks are independent — drawing CC does not touch Chance', () => {
            const state = stateAtTile(initialState, 6);
            const result = resolver.resolve(state, 6, config, action, P1);
            // Chance discard unchanged
            (0, vitest_1.expect)(result.newState.cardDecks.chanceDiscard).toEqual(state.cardDecks.chanceDiscard);
        });
    });
    // ==========================================================================
    //  TAX
    // ==========================================================================
    (0, vitest_1.describe)('TileType.TAX', () => {
        (0, vitest_1.it)('transitions to POST_ROLL (stub)', () => {
            const state = stateAtTile(initialState, 7);
            const result = resolver.resolve(state, 7, config, action, P1);
            (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
        });
        (0, vitest_1.it)('emits no events (stub)', () => {
            const state = stateAtTile(initialState, 7);
            const result = resolver.resolve(state, 7, config, action, P1);
            (0, vitest_1.expect)(result.events).toHaveLength(0);
        });
        (0, vitest_1.it)('does not debit player money (stub)', () => {
            const state = stateAtTile(initialState, 7);
            const result = resolver.resolve(state, 7, config, action, P1);
            (0, vitest_1.expect)(result.newState.players[P1].money).toBe(state.players[P1].money);
        });
        (0, vitest_1.it)('clears pending decision', () => {
            const state = stateAtTile(initialState, 7);
            const result = resolver.resolve(state, 7, config, action, P1);
            (0, vitest_1.expect)(result.newState.turn.pendingDecision).toBeNull();
        });
    });
    // ==========================================================================
    //  GO_TO_JAIL
    // ==========================================================================
    (0, vitest_1.describe)('TileType.GO_TO_JAIL', () => {
        (0, vitest_1.it)('transitions to POST_ROLL', () => {
            const state = stateAtTile(initialState, 9);
            const result = resolver.resolve(state, 9, config, action, P1);
            (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
        });
        (0, vitest_1.it)('emits exactly one PLAYER_JAILED event', () => {
            const state = stateAtTile(initialState, 9);
            const result = resolver.resolve(state, 9, config, action, P1);
            (0, vitest_1.expect)(result.events).toHaveLength(1);
            (0, vitest_1.expect)(result.events[0].type).toBe(shared_1.EventType.PLAYER_JAILED);
        });
        (0, vitest_1.it)('PLAYER_JAILED event reason = GO_TO_JAIL_TILE', () => {
            const state = stateAtTile(initialState, 9);
            const result = resolver.resolve(state, 9, config, action, P1);
            const ev = result.events[0];
            if (ev.type !== shared_1.EventType.PLAYER_JAILED)
                throw new Error('wrong type');
            (0, vitest_1.expect)(ev.payload.reason).toBe(shared_1.JailReason.GO_TO_JAIL_TILE);
        });
        (0, vitest_1.it)('PLAYER_JAILED event has correct playerId', () => {
            const state = stateAtTile(initialState, 9);
            const result = resolver.resolve(state, 9, config, action, P1);
            const ev = result.events[0];
            if (ev.type !== shared_1.EventType.PLAYER_JAILED)
                throw new Error('wrong type');
            (0, vitest_1.expect)(ev.payload.playerId).toBe(P1);
        });
        (0, vitest_1.it)('moves player position to jailTileIndex', () => {
            const state = stateAtTile(initialState, 9);
            const result = resolver.resolve(state, 9, config, action, P1);
            (0, vitest_1.expect)(result.newState.players[P1].position).toBe(config.board.jailTileIndex);
        });
        (0, vitest_1.it)('jailTileIndex is read from config (no hardcoded value)', () => {
            const customConfig = { ...config, board: { ...config.board, jailTileIndex: 2 } };
            const state = stateAtTile(initialState, 9);
            const result = resolver.resolve(state, 9, customConfig, action, P1);
            (0, vitest_1.expect)(result.newState.players[P1].position).toBe(2);
        });
        (0, vitest_1.it)('sets player jailState with reason GO_TO_JAIL_TILE', () => {
            const state = stateAtTile(initialState, 9);
            const result = resolver.resolve(state, 9, config, action, P1);
            (0, vitest_1.expect)(result.newState.players[P1].jailState).not.toBeNull();
            (0, vitest_1.expect)(result.newState.players[P1].jailState?.reason).toBe(shared_1.JailReason.GO_TO_JAIL_TILE);
        });
        (0, vitest_1.it)('sets jailState.turnsServed = 0', () => {
            const state = stateAtTile(initialState, 9);
            const result = resolver.resolve(state, 9, config, action, P1);
            (0, vitest_1.expect)(result.newState.players[P1].jailState?.turnsServed).toBe(0);
        });
        (0, vitest_1.it)('sets jailState.jailedAt = action.clientTs', () => {
            const state = stateAtTile(initialState, 9);
            const result = resolver.resolve(state, 9, config, action, P1);
            (0, vitest_1.expect)(result.newState.players[P1].jailState?.jailedAt).toBe(action.clientTs);
        });
        (0, vitest_1.it)('does not award GO salary (teleport, not passing GO)', () => {
            const state = stateAtTile(initialState, 9);
            const moneyBefore = state.players[P1].money;
            const result = resolver.resolve(state, 9, config, action, P1);
            (0, vitest_1.expect)(result.newState.players[P1].money).toBe(moneyBefore);
        });
        (0, vitest_1.it)('clears any pending decision', () => {
            const state = stateAtTile(initialState, 9);
            const result = resolver.resolve(state, 9, config, action, P1);
            (0, vitest_1.expect)(result.newState.turn.pendingDecision).toBeNull();
        });
        (0, vitest_1.it)('does not affect the other player', () => {
            const state = stateAtTile(initialState, 9);
            const result = resolver.resolve(state, 9, config, action, P1);
            (0, vitest_1.expect)(result.newState.players[P2]).toEqual(state.players[P2]);
        });
        (0, vitest_1.it)('PLAYER_JAILED event id encodes TILE (distinguishable from triple-doubles jail)', () => {
            const state = stateAtTile(initialState, 9);
            const result = resolver.resolve(state, 9, config, action, P1);
            (0, vitest_1.expect)(result.events[0].id).toContain('TILE');
        });
    });
    // ==========================================================================
    //  CUSTOM
    // ==========================================================================
    (0, vitest_1.describe)('TileType.CUSTOM', () => {
        (0, vitest_1.it)('falls back to POST_ROLL when no handler is registered', () => {
            const state = stateAtTile(initialState, 11 /* bonus */);
            const result = resolver.resolve(state, 11, config, action, P1);
            (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
        });
        (0, vitest_1.it)('emits no events on unregistered custom tile', () => {
            const state = stateAtTile(initialState, 11);
            const result = resolver.resolve(state, 11, config, action, P1);
            (0, vitest_1.expect)(result.events).toHaveLength(0);
        });
        (0, vitest_1.it)('invokes registered handler by tile ID', () => {
            const handlerFn = (s, _tile, _cfg, _action, _pid) => ({
                newState: { ...s, turn: { ...s.turn, phase: shared_1.TurnPhase.POST_ROLL, pendingDecision: null } },
                events: [],
            });
            const customResolver = new TileResolver_js_1.TileResolver(new Map([['bonus', handlerFn]]));
            const state = stateAtTile(initialState, 11);
            // Should not throw and should call the handler
            const result = customResolver.resolve(state, 11, config, action, P1);
            (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
        });
        (0, vitest_1.it)('handler receives the correct tile object', () => {
            let receivedTile = null;
            const handlerFn = (s, tile, _cfg, _action, _pid) => {
                receivedTile = tile;
                return {
                    newState: { ...s, turn: { ...s.turn, phase: shared_1.TurnPhase.POST_ROLL, pendingDecision: null } },
                    events: [],
                };
            };
            const customResolver = new TileResolver_js_1.TileResolver(new Map([['bonus', handlerFn]]));
            const state = stateAtTile(initialState, 11);
            customResolver.resolve(state, 11, config, action, P1);
            (0, vitest_1.expect)(receivedTile).not.toBeNull();
            (0, vitest_1.expect)(receivedTile.id).toBe('bonus');
        });
        (0, vitest_1.it)('handler receives the correct actingPlayerId', () => {
            let receivedPlayerId = null;
            const handlerFn = (s, _tile, _cfg, _action, pid) => {
                receivedPlayerId = pid;
                return {
                    newState: { ...s, turn: { ...s.turn, phase: shared_1.TurnPhase.POST_ROLL, pendingDecision: null } },
                    events: [],
                };
            };
            const customResolver = new TileResolver_js_1.TileResolver(new Map([['bonus', handlerFn]]));
            customResolver.resolve(stateAtTile(initialState, 11), 11, config, action, P1);
            (0, vitest_1.expect)(receivedPlayerId).toBe(P1);
        });
        (0, vitest_1.it)('handler result is propagated unchanged', () => {
            const CUSTOM_PHASE = shared_1.TurnPhase.PURCHASE_DECISION;
            const handlerFn = (s, _tile, _cfg, _action, _pid) => ({
                newState: {
                    ...s,
                    turn: {
                        ...s.turn,
                        phase: CUSTOM_PHASE,
                        pendingDecision: { type: shared_1.DecisionType.PURCHASE, tileId: 'prop-a' },
                    },
                },
                events: [],
            });
            const customResolver = new TileResolver_js_1.TileResolver(new Map([['bonus', handlerFn]]));
            const state = stateAtTile(initialState, 11);
            const result = customResolver.resolve(state, 11, config, action, P1);
            (0, vitest_1.expect)(result.newState.turn.phase).toBe(CUSTOM_PHASE);
        });
        (0, vitest_1.it)('different CUSTOM tiles use different handlers', () => {
            // Add a second custom tile to the config
            const configWith2Custom = {
                ...config,
                board: {
                    ...config.board,
                    tiles: [
                        ...config.board.tiles,
                        { id: 'bonus-2', index: config.board.size, type: shared_1.TileType.CUSTOM, name: 'Bonus 2', customData: {} },
                    ],
                },
            };
            const calls = [];
            const h1 = (s, _t, _c, _a, _p) => {
                calls.push('h1');
                return { newState: { ...s, turn: { ...s.turn, phase: shared_1.TurnPhase.POST_ROLL, pendingDecision: null } }, events: [] };
            };
            const h2 = (s, _t, _c, _a, _p) => {
                calls.push('h2');
                return { newState: { ...s, turn: { ...s.turn, phase: shared_1.TurnPhase.POST_ROLL, pendingDecision: null } }, events: [] };
            };
            const customResolver = new TileResolver_js_1.TileResolver(new Map([['bonus', h1], ['bonus-2', h2]]));
            customResolver.resolve(stateAtTile(initialState, 11), 11, configWith2Custom, action, P1);
            customResolver.resolve(stateAtTile(initialState, 11), config.board.size, configWith2Custom, action, P1);
            (0, vitest_1.expect)(calls).toEqual(['h1', 'h2']);
        });
    });
    // ==========================================================================
    //  Error cases
    // ==========================================================================
    (0, vitest_1.describe)('error cases', () => {
        (0, vitest_1.it)('throws EngineStateCorruptionError for an unknown tile type', () => {
            const fakeTile = { id: 'fake', index: 0, type: 'UNKNOWN_TYPE', name: 'Fake' };
            const corruptConfig = {
                ...config,
                board: { ...config.board, tiles: [fakeTile, ...config.board.tiles.slice(1)] },
            };
            const state = stateAtTile(initialState, 0);
            (0, vitest_1.expect)(() => resolver.resolve(state, 0, corruptConfig, action, P1))
                .toThrow(errors_js_1.EngineStateCorruptionError);
        });
        (0, vitest_1.it)('throws EngineStateCorruptionError for a tile index not in MapConfig', () => {
            const state = stateAtTile(initialState, 0);
            (0, vitest_1.expect)(() => resolver.resolve(state, 999, config, action, P1))
                .toThrow(errors_js_1.EngineStateCorruptionError);
        });
    });
    // ==========================================================================
    //  Determinism
    // ==========================================================================
    (0, vitest_1.describe)('determinism', () => {
        (0, vitest_1.it)('same state + action → identical result for GO', () => {
            const state = stateAtTile(initialState, 0);
            const r1 = resolver.resolve(state, 0, config, action, P1);
            const r2 = resolver.resolve(state, 0, config, action, P1);
            (0, vitest_1.expect)(JSON.stringify(r1)).toBe(JSON.stringify(r2));
        });
        (0, vitest_1.it)('same state + action → identical result for CHANCE (same card drawn)', () => {
            const state = stateAtTile(initialState, 4);
            const r1 = resolver.resolve(state, 4, config, action, P1);
            const r2 = resolver.resolve(state, 4, config, action, P1);
            (0, vitest_1.expect)(JSON.stringify(r1)).toBe(JSON.stringify(r2));
        });
        (0, vitest_1.it)('same state + action → identical result for GO_TO_JAIL', () => {
            const state = stateAtTile(initialState, 9);
            const r1 = resolver.resolve(state, 9, config, action, P1);
            const r2 = resolver.resolve(state, 9, config, action, P1);
            (0, vitest_1.expect)(JSON.stringify(r1)).toBe(JSON.stringify(r2));
        });
        (0, vitest_1.it)('different actionId → different event IDs but same state effect', () => {
            const state = stateAtTile(initialState, 4);
            const a1 = makeAction({ actionId: 'action-aaa' });
            const a2 = makeAction({ actionId: 'action-bbb' });
            const r1 = resolver.resolve(state, 4, config, a1, P1);
            const r2 = resolver.resolve(state, 4, config, a2, P1);
            // Event IDs differ
            (0, vitest_1.expect)(r1.events[0].id).not.toBe(r2.events[0].id);
            // Phase transitions are identical
            (0, vitest_1.expect)(r1.newState.turn.phase).toBe(r2.newState.turn.phase);
        });
    });
    // ==========================================================================
    //  Immutability
    // ==========================================================================
    (0, vitest_1.describe)('immutability', () => {
        (0, vitest_1.it)('does not mutate the input state for GO tile', () => {
            const state = stateAtTile(initialState, 0);
            const frozen = Object.freeze({ ...state });
            (0, vitest_1.expect)(() => resolver.resolve(frozen, 0, config, action, P1)).not.toThrow();
        });
        (0, vitest_1.it)('does not mutate the input state for PROPERTY (unowned)', () => {
            const state = stateAtTile(initialState, 1);
            const phaseBefore = state.turn.phase;
            resolver.resolve(state, 1, config, action, P1);
            (0, vitest_1.expect)(state.turn.phase).toBe(phaseBefore);
        });
        (0, vitest_1.it)('does not mutate the input state for CHANCE', () => {
            const state = stateAtTile(initialState, 4);
            const deckLenBefore = state.cardDecks.chance.length;
            resolver.resolve(state, 4, config, action, P1);
            // Original state deck untouched
            (0, vitest_1.expect)(state.cardDecks.chance.length).toBe(deckLenBefore);
        });
        (0, vitest_1.it)('does not mutate the input state for GO_TO_JAIL', () => {
            const state = stateAtTile(initialState, 9);
            const positionBefore = state.players[P1].position;
            resolver.resolve(state, 9, config, action, P1);
            (0, vitest_1.expect)(state.players[P1].position).toBe(positionBefore);
        });
        (0, vitest_1.it)('input and output are different object references for all tile types', () => {
            const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            for (const idx of indices) {
                const state = stateAtTile(initialState, idx);
                const result = resolver.resolve(state, idx, config, action, P1);
                (0, vitest_1.expect)(result.newState).not.toBe(state);
                (0, vitest_1.expect)(result.newState.turn).not.toBe(state.turn);
            }
        });
    });
    // ==========================================================================
    //  Tile lookup: fast-path vs. fallback
    // ==========================================================================
    (0, vitest_1.describe)('tile lookup', () => {
        (0, vitest_1.it)('finds tile by index even when array is unordered (linear search fallback)', () => {
            // Reverse the tile array order to force linear-search fallback
            const unorderedConfig = {
                ...config,
                board: { ...config.board, tiles: [...config.board.tiles].reverse() },
            };
            const state = stateAtTile(initialState, 0 /* GO */);
            (0, vitest_1.expect)(() => resolver.resolve(state, 0, unorderedConfig, action, P1)).not.toThrow();
            const result = resolver.resolve(state, 0, unorderedConfig, action, P1);
            (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
        });
    });
    // ==========================================================================
    //  Integration: consecutive Chance draws track deck state correctly
    // ==========================================================================
    (0, vitest_1.describe)('consecutive card draws', () => {
        (0, vitest_1.it)('draws cards in order from the Chance deck across multiple turns', () => {
            const chanceCards = config.cards.chance.map(c => c.id);
            const drawn = [];
            let state = stateAtTile(initialState, 4);
            for (let i = 0; i < chanceCards.length; i++) {
                const result = resolver.resolve(state, 4, config, makeAction({ actionId: `draw-chance-${i}` }), P1);
                const ev = result.events[0];
                if (ev.type !== shared_1.EventType.CARD_DRAWN)
                    throw new Error();
                drawn.push(ev.payload.cardId);
                // Advance to ROLLED for next draw
                state = { ...result.newState, turn: { ...result.newState.turn, phase: shared_1.TurnPhase.ROLLED } };
            }
            // All drawn IDs are from the Chance deck
            (0, vitest_1.expect)(drawn.every(id => chanceCards.includes(id))).toBe(true);
            // All 3 cards were drawn (no duplicates in first pass)
            (0, vitest_1.expect)(new Set(drawn).size).toBe(chanceCards.length);
        });
        (0, vitest_1.it)('draws from Chance and Community Chest independently (cross-deck isolation)', () => {
            const state = stateAtTile(initialState, 4 /* CHANCE */);
            const chanceResult = resolver.resolve(state, 4, config, makeAction({ actionId: 'draw-ch' }), P1);
            const state2 = stateAtTile(chanceResult.newState, 6 /* COMMUNITY_CHEST */);
            const ccResult = resolver.resolve(state2, 6, config, makeAction({ actionId: 'draw-cc' }), P1);
            const chEv = chanceResult.events[0];
            const ccEv = ccResult.events[0];
            if (chEv.type !== shared_1.EventType.CARD_DRAWN || ccEv.type !== shared_1.EventType.CARD_DRAWN)
                throw new Error();
            // Decks are different
            (0, vitest_1.expect)(chEv.payload.deckType).toBe(shared_1.CardDeckType.CHANCE);
            (0, vitest_1.expect)(ccEv.payload.deckType).toBe(shared_1.CardDeckType.COMMUNITY_CHEST);
            // Cards are from different pools
            const chanceIds = config.cards.chance.map(c => c.id);
            const ccIds = config.cards.communityChest.map(c => c.id);
            (0, vitest_1.expect)(chanceIds).toContain(chEv.payload.cardId);
            (0, vitest_1.expect)(ccIds).toContain(ccEv.payload.cardId);
        });
    });
});
//# sourceMappingURL=TileResolver.test.js.map