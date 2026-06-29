"use strict";
// =============================================================================
// tests/unit/engine/GameEngine.createInitialState.test.ts
//
// Unit tests for GameEngine.createInitialState() and GameEngine.computeChecksum().
//
// Test matrix:
//  - 2-player game: all state fields initialised correctly
//  - 8-player game: scaling correctness
//  - Deterministic RNG: same seed → same RNGState
//  - Deterministic deck shuffling: same seed → identical deck order
//  - Full determinism: identical seeds produce byte-for-byte identical GameState
//  - Divergence: different seeds produce different deck orders
//  - Checksum generation and mutation detection
//  - GAME_STARTED event correctness
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const GameEngine_js_1 = require("../../../src/engine/GameEngine.js");
const DiceEngine_js_1 = require("../../../src/engine/DiceEngine.js");
const shared_1 = require("@monopoly/shared");
// =============================================================================
// Fixtures
// =============================================================================
/**
 * Minimal but structurally complete MapConfig for testing.
 *
 * Board: 10 tiles (the engine doesn't require board.size === len(tiles) for init).
 * Cards: 6 Chance + 6 Community Chest (720 possible orderings — collision prob ~0.14%).
 */
function createTestMapConfig() {
    return {
        schemaVersion: '1.0',
        meta: {
            id: 'test-map',
            name: 'Test Monopoly',
            description: 'Minimal map for unit tests',
            playerTokens: [
                { id: 'token-1', name: 'Hat', iconUrl: 'hat.png' },
                { id: 'token-2', name: 'Car', iconUrl: 'car.png' },
                { id: 'token-3', name: 'Dog', iconUrl: 'dog.png' },
                { id: 'token-4', name: 'Iron', iconUrl: 'iron.png' },
                { id: 'token-5', name: 'Ship', iconUrl: 'ship.png' },
                { id: 'token-6', name: 'Thimble', iconUrl: 'thimble.png' },
                { id: 'token-7', name: 'Cannon', iconUrl: 'cannon.png' },
                { id: 'token-8', name: 'Wheelbarrow', iconUrl: 'wheelbarrow.png' },
            ],
        },
        bank: {
            startingMoney: 1500,
            infiniteMoney: false,
            initialHouses: 32,
            initialHotels: 12,
            goReward: 200,
        },
        board: {
            size: 40,
            jailTileIndex: 7,
            tiles: [
                // index 0
                { id: 'go', index: 0, type: shared_1.TileType.GO, name: 'GO' },
                // index 1
                {
                    id: 'mediterranean-avenue',
                    index: 1,
                    type: shared_1.TileType.PROPERTY,
                    name: 'Mediterranean Avenue',
                    propertyData: {
                        groupId: 'purple',
                        price: 60,
                        rents: {
                            base: 2,
                            colorGroup: 4,
                            oneHouse: 10,
                            twoHouses: 30,
                            threeHouses: 90,
                            fourHouses: 160,
                            hotel: 250,
                        },
                        houseCost: 50,
                        hotelCost: 50,
                        mortgageValue: 30,
                        unmortgageCost: 33,
                    },
                },
                // index 2
                {
                    id: 'community-chest-1',
                    index: 2,
                    type: shared_1.TileType.COMMUNITY_CHEST,
                    name: 'Community Chest',
                },
                // index 3
                {
                    id: 'baltic-avenue',
                    index: 3,
                    type: shared_1.TileType.PROPERTY,
                    name: 'Baltic Avenue',
                    propertyData: {
                        groupId: 'purple',
                        price: 60,
                        rents: {
                            base: 4,
                            colorGroup: 8,
                            oneHouse: 20,
                            twoHouses: 60,
                            threeHouses: 180,
                            fourHouses: 320,
                            hotel: 450,
                        },
                        houseCost: 50,
                        hotelCost: 50,
                        mortgageValue: 30,
                        unmortgageCost: 33,
                    },
                },
                // index 4
                {
                    id: 'income-tax',
                    index: 4,
                    type: shared_1.TileType.TAX,
                    name: 'Income Tax',
                    taxData: {
                        amount: 200,
                        isPercentage: false,
                        destination: shared_1.TaxDestination.BANK,
                    },
                },
                // index 5
                {
                    id: 'reading-railroad',
                    index: 5,
                    type: shared_1.TileType.RAILROAD,
                    name: 'Reading Railroad',
                    railroadData: {
                        price: 200,
                        rents: [25, 50, 100, 200],
                        mortgageValue: 100,
                        unmortgageCost: 110,
                    },
                },
                // index 6
                {
                    id: 'chance-1',
                    index: 6,
                    type: shared_1.TileType.CHANCE,
                    name: 'Chance',
                },
                // index 7 — JAIL
                {
                    id: 'jail',
                    index: 7,
                    type: shared_1.TileType.JAIL_VISIT,
                    name: 'Just Visiting / Jail',
                },
                // index 8
                {
                    id: 'free-parking',
                    index: 8,
                    type: shared_1.TileType.FREE_PARKING,
                    name: 'Free Parking',
                },
                // index 9
                {
                    id: 'go-to-jail',
                    index: 9,
                    type: shared_1.TileType.GO_TO_JAIL,
                    name: 'Go To Jail',
                },
            ],
            propertyGroups: [
                {
                    id: 'purple',
                    name: 'Purple',
                    color: '#8B008B',
                    tileIds: ['mediterranean-avenue', 'baltic-avenue'],
                },
            ],
        },
        cards: {
            chance: [
                {
                    id: 'ch-1',
                    text: 'Advance to GO',
                    deckType: shared_1.CardDeckType.CHANCE,
                    effect: { type: shared_1.CardEffectType.MOVE_TO_TILE, tileId: 'go' },
                },
                {
                    id: 'ch-2',
                    text: 'Bank pays dividend of $50',
                    deckType: shared_1.CardDeckType.CHANCE,
                    effect: { type: shared_1.CardEffectType.COLLECT_FROM_BANK, amount: 50 },
                },
                {
                    id: 'ch-3',
                    text: 'Go to Jail',
                    deckType: shared_1.CardDeckType.CHANCE,
                    effect: { type: shared_1.CardEffectType.GO_TO_JAIL },
                },
                {
                    id: 'ch-4',
                    text: 'Go back 3 spaces',
                    deckType: shared_1.CardDeckType.CHANCE,
                    effect: { type: shared_1.CardEffectType.MOVE_BACKWARD, steps: 3 },
                },
                {
                    id: 'ch-5',
                    text: 'Pay poor tax $15',
                    deckType: shared_1.CardDeckType.CHANCE,
                    effect: { type: shared_1.CardEffectType.PAY_TO_BANK, amount: 15 },
                },
                {
                    id: 'ch-6',
                    text: 'Get Out of Jail Free',
                    deckType: shared_1.CardDeckType.CHANCE,
                    effect: { type: shared_1.CardEffectType.GET_OUT_OF_JAIL_FREE },
                },
            ],
            communityChest: [
                {
                    id: 'cc-1',
                    text: 'Bank error in your favour — collect $200',
                    deckType: shared_1.CardDeckType.COMMUNITY_CHEST,
                    effect: { type: shared_1.CardEffectType.COLLECT_FROM_BANK, amount: 200 },
                },
                {
                    id: 'cc-2',
                    text: "Doctor's fee — pay $50",
                    deckType: shared_1.CardDeckType.COMMUNITY_CHEST,
                    effect: { type: shared_1.CardEffectType.PAY_TO_BANK, amount: 50 },
                },
                {
                    id: 'cc-3',
                    text: 'Get Out of Jail Free',
                    deckType: shared_1.CardDeckType.COMMUNITY_CHEST,
                    effect: { type: shared_1.CardEffectType.GET_OUT_OF_JAIL_FREE },
                },
                {
                    id: 'cc-4',
                    text: 'It is your birthday — collect $10 from each player',
                    deckType: shared_1.CardDeckType.COMMUNITY_CHEST,
                    effect: { type: shared_1.CardEffectType.COLLECT_FROM_PLAYERS, amount: 10 },
                },
                {
                    id: 'cc-5',
                    text: 'Income tax refund — collect $20',
                    deckType: shared_1.CardDeckType.COMMUNITY_CHEST,
                    effect: { type: shared_1.CardEffectType.COLLECT_FROM_BANK, amount: 20 },
                },
                {
                    id: 'cc-6',
                    text: 'Go to Jail',
                    deckType: shared_1.CardDeckType.COMMUNITY_CHEST,
                    effect: { type: shared_1.CardEffectType.GO_TO_JAIL },
                },
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
            auctionConfig: {
                durationSeconds: 30,
                extensionSeconds: 10,
                extensionThreshold: 5,
                minBidIncrement: 10,
                maxExtensions: 10,
            },
        },
    };
}
/** Build N test players with stable, predictable IDs. */
function createTestPlayers(count) {
    return Array.from({ length: count }, (_, i) => ({
        userId: `user-${i + 1}`,
        playerId: `player-${i + 1}`,
        displayName: `Player ${i + 1}`,
        avatarUrl: `https://example.com/avatar/${i + 1}.png`,
        tokenId: `token-${i + 1}`,
    }));
}
/** Baseline params — override specific fields per test. */
function createBaseParams(overrides = {}) {
    return {
        gameId: 'game-test-001',
        roomId: 'room-test-001',
        mapConfig: createTestMapConfig(),
        players: createTestPlayers(2),
        rngSeed: 'deterministic-seed-abc123',
        createdAt: 1_750_000_000_000, // Fixed timestamp for reproducibility
        ...overrides,
    };
}
// =============================================================================
// Test Suite
// =============================================================================
(0, vitest_1.describe)('GameEngine.createInitialState', () => {
    // ---------------------------------------------------------------------------
    // 2-Player Game
    // ---------------------------------------------------------------------------
    (0, vitest_1.describe)('2-player game', () => {
        let result;
        (0, vitest_1.beforeEach)(() => {
            result = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
        });
        (0, vitest_1.it)('returns an EngineResult with newState and events', () => {
            (0, vitest_1.expect)(result).toHaveProperty('newState');
            (0, vitest_1.expect)(result).toHaveProperty('events');
            (0, vitest_1.expect)(Array.isArray(result.events)).toBe(true);
        });
        (0, vitest_1.it)('sets phase to IN_PROGRESS', () => {
            (0, vitest_1.expect)(result.newState.phase).toBe(shared_1.GamePhase.IN_PROGRESS);
        });
        (0, vitest_1.it)('sets version to 1', () => {
            (0, vitest_1.expect)(result.newState.version).toBe(1);
        });
        (0, vitest_1.it)('stores the correct gameId and roomId', () => {
            (0, vitest_1.expect)(result.newState.id).toBe('game-test-001');
            (0, vitest_1.expect)(result.newState.roomId).toBe('room-test-001');
        });
        (0, vitest_1.it)('stores the correct mapId from MapConfig', () => {
            (0, vitest_1.expect)(result.newState.mapId).toBe('test-map');
        });
        (0, vitest_1.it)('sets playerOrder with exactly 2 entries matching input order', () => {
            const { playerOrder } = result.newState;
            (0, vitest_1.expect)(playerOrder).toHaveLength(2);
            (0, vitest_1.expect)(playerOrder[0]).toBe('player-1');
            (0, vitest_1.expect)(playerOrder[1]).toBe('player-2');
        });
        (0, vitest_1.it)('creates a PlayerState for every player', () => {
            (0, vitest_1.expect)(Object.keys(result.newState.players)).toHaveLength(2);
            (0, vitest_1.expect)(result.newState.players['player-1']).toBeDefined();
            (0, vitest_1.expect)(result.newState.players['player-2']).toBeDefined();
        });
        (0, vitest_1.it)('starts every player at position 0 (GO)', () => {
            for (const pid of result.newState.playerOrder) {
                (0, vitest_1.expect)(result.newState.players[pid]?.position).toBe(0);
            }
        });
        (0, vitest_1.it)('gives every player the configured starting money', () => {
            const startingMoney = createTestMapConfig().bank.startingMoney; // 1500
            for (const pid of result.newState.playerOrder) {
                (0, vitest_1.expect)(result.newState.players[pid]?.money).toBe(startingMoney);
            }
        });
        (0, vitest_1.it)('initialises every player with empty properties array', () => {
            for (const pid of result.newState.playerOrder) {
                (0, vitest_1.expect)(result.newState.players[pid]?.properties).toEqual([]);
            }
        });
        (0, vitest_1.it)('initialises every player with jailState null', () => {
            for (const pid of result.newState.playerOrder) {
                (0, vitest_1.expect)(result.newState.players[pid]?.jailState).toBeNull();
            }
        });
        (0, vitest_1.it)('initialises every player with 0 jail cards', () => {
            for (const pid of result.newState.playerOrder) {
                (0, vitest_1.expect)(result.newState.players[pid]?.getOutOfJailCards).toBe(0);
            }
        });
        (0, vitest_1.it)('initialises every player as not bankrupt', () => {
            for (const pid of result.newState.playerOrder) {
                (0, vitest_1.expect)(result.newState.players[pid]?.isBankrupt).toBe(false);
            }
        });
        (0, vitest_1.it)('initialises every player as connected', () => {
            for (const pid of result.newState.playerOrder) {
                (0, vitest_1.expect)(result.newState.players[pid]?.isConnected).toBe(true);
            }
        });
        (0, vitest_1.it)('sets netWorth equal to starting money (no assets yet)', () => {
            const startingMoney = createTestMapConfig().bank.startingMoney;
            for (const pid of result.newState.playerOrder) {
                (0, vitest_1.expect)(result.newState.players[pid]?.netWorth).toBe(startingMoney);
            }
        });
        (0, vitest_1.it)('stores correct player display names', () => {
            (0, vitest_1.expect)(result.newState.players['player-1']?.displayName).toBe('Player 1');
            (0, vitest_1.expect)(result.newState.players['player-2']?.displayName).toBe('Player 2');
        });
    });
    // ---------------------------------------------------------------------------
    // Board State
    // ---------------------------------------------------------------------------
    (0, vitest_1.describe)('board state initialisation', () => {
        (0, vitest_1.it)('creates a TileState for every tile in MapConfig', () => {
            const mapConfig = createTestMapConfig();
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ mapConfig }));
            const tileCount = mapConfig.board.tiles.length;
            (0, vitest_1.expect)(Object.keys(newState.board.tiles)).toHaveLength(tileCount);
        });
        (0, vitest_1.it)('initialises all tiles as unowned', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            for (const tile of Object.values(newState.board.tiles)) {
                (0, vitest_1.expect)(tile.ownerId).toBeNull();
            }
        });
        (0, vitest_1.it)('initialises all tiles with 0 houses', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            for (const tile of Object.values(newState.board.tiles)) {
                (0, vitest_1.expect)(tile.houses).toBe(0);
            }
        });
        (0, vitest_1.it)('initialises all tiles without hotels', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            for (const tile of Object.values(newState.board.tiles)) {
                (0, vitest_1.expect)(tile.hasHotel).toBe(false);
            }
        });
        (0, vitest_1.it)('initialises all tiles as unmortgaged', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            for (const tile of Object.values(newState.board.tiles)) {
                (0, vitest_1.expect)(tile.isMortgaged).toBe(false);
            }
        });
        (0, vitest_1.it)('keys tiles by their tile IDs from MapConfig', () => {
            const mapConfig = createTestMapConfig();
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ mapConfig }));
            for (const tileDef of mapConfig.board.tiles) {
                (0, vitest_1.expect)(newState.board.tiles[tileDef.id]).toBeDefined();
            }
        });
    });
    // ---------------------------------------------------------------------------
    // Bank State
    // ---------------------------------------------------------------------------
    (0, vitest_1.describe)('bank state initialisation', () => {
        (0, vitest_1.it)('initialises bank with houses from MapConfig', () => {
            const mapConfig = createTestMapConfig(); // initialHouses = 32
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ mapConfig }));
            (0, vitest_1.expect)(newState.bank.houses).toBe(32);
        });
        (0, vitest_1.it)('initialises bank with hotels from MapConfig', () => {
            const mapConfig = createTestMapConfig(); // initialHotels = 12
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ mapConfig }));
            (0, vitest_1.expect)(newState.bank.hotels).toBe(12);
        });
        (0, vitest_1.it)('initialises freeParkingPot at 0', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.bank.freeParkingPot).toBe(0);
        });
        (0, vitest_1.it)('sets bank.money to MAX_SAFE_INTEGER when infiniteMoney is true', () => {
            const mapConfig = createTestMapConfig();
            mapConfig.bank.infiniteMoney = true;
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ mapConfig }));
            (0, vitest_1.expect)(newState.bank.money).toBe(Number.MAX_SAFE_INTEGER);
        });
        (0, vitest_1.it)('sets a positive finite bank.money when infiniteMoney is false', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            // mapConfig.bank.infiniteMoney = false in fixture
            (0, vitest_1.expect)(newState.bank.money).toBeGreaterThan(0);
            (0, vitest_1.expect)(newState.bank.money).toBeLessThan(Number.MAX_SAFE_INTEGER);
        });
    });
    // ---------------------------------------------------------------------------
    // Turn State
    // ---------------------------------------------------------------------------
    (0, vitest_1.describe)('turn state initialisation', () => {
        (0, vitest_1.it)('sets currentPlayerId to the first player in playerOrder', () => {
            const players = createTestPlayers(2);
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ players }));
            (0, vitest_1.expect)(newState.turn.currentPlayerId).toBe(players[0].playerId);
        });
        (0, vitest_1.it)('sets turn number to 1', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.turn.turnNumber).toBe(1);
        });
        (0, vitest_1.it)('sets initial turn phase to PRE_ROLL', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.turn.phase).toBe(shared_1.TurnPhase.PRE_ROLL);
        });
        (0, vitest_1.it)('initialises diceValues as null', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.turn.diceValues).toBeNull();
        });
        (0, vitest_1.it)('initialises isDoubles as false', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.turn.isDoubles).toBe(false);
        });
        (0, vitest_1.it)('initialises consecutiveDoubles as 0', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.turn.consecutiveDoubles).toBe(0);
        });
        (0, vitest_1.it)('initialises pendingDecision as null', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.turn.pendingDecision).toBeNull();
        });
        (0, vitest_1.it)('sets turnExpiresAt to createdAt + turnTimeSeconds', () => {
            const createdAt = 1_750_000_000_000;
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ createdAt }));
            // Default turnTimeSeconds = 120 (from buildGameSettings default)
            const expectedExpiry = createdAt + 120 * 1000;
            (0, vitest_1.expect)(newState.turn.turnExpiresAt).toBe(expectedExpiry);
        });
    });
    // ---------------------------------------------------------------------------
    // Card Deck State
    // ---------------------------------------------------------------------------
    (0, vitest_1.describe)('card deck state initialisation', () => {
        (0, vitest_1.it)('initialises Chance draw pile with all 6 cards', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.cardDecks.chance).toHaveLength(6);
        });
        (0, vitest_1.it)('initialises Community Chest draw pile with all 6 cards', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.cardDecks.communityChest).toHaveLength(6);
        });
        (0, vitest_1.it)('initialises discard piles as empty', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.cardDecks.chanceDiscard).toHaveLength(0);
            (0, vitest_1.expect)(newState.cardDecks.communityChestDiscard).toHaveLength(0);
        });
        (0, vitest_1.it)('Chance draw pile contains exactly the card IDs from MapConfig', () => {
            const mapConfig = createTestMapConfig();
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ mapConfig }));
            const expectedIds = new Set(mapConfig.cards.chance.map(c => c.id));
            const actualIds = new Set(newState.cardDecks.chance);
            (0, vitest_1.expect)(actualIds).toEqual(expectedIds);
        });
        (0, vitest_1.it)('Community Chest draw pile contains exactly the card IDs from MapConfig', () => {
            const mapConfig = createTestMapConfig();
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ mapConfig }));
            const expectedIds = new Set(mapConfig.cards.communityChest.map(c => c.id));
            const actualIds = new Set(newState.cardDecks.communityChest);
            (0, vitest_1.expect)(actualIds).toEqual(expectedIds);
        });
    });
    // ---------------------------------------------------------------------------
    // Collections initialised to empty
    // ---------------------------------------------------------------------------
    (0, vitest_1.describe)('empty collections', () => {
        (0, vitest_1.it)('initialises activeTrades as empty', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(Object.keys(newState.activeTrades)).toHaveLength(0);
        });
        (0, vitest_1.it)('initialises auction as null', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.auction).toBeNull();
        });
    });
    // ---------------------------------------------------------------------------
    // Settings
    // ---------------------------------------------------------------------------
    (0, vitest_1.describe)('game settings', () => {
        (0, vitest_1.it)('sets mapId from MapConfig.meta.id', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.settings.mapId).toBe('test-map');
        });
        (0, vitest_1.it)('sets startingMoney from MapConfig.bank.startingMoney', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.settings.startingMoney).toBe(1500);
        });
        (0, vitest_1.it)('overrides startingMoney when settingsOverrides are provided', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ settingsOverrides: { startingMoney: 2000 } }));
            (0, vitest_1.expect)(newState.settings.startingMoney).toBe(2000);
        });
        (0, vitest_1.it)('uses overridden startingMoney for player initial money', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ settingsOverrides: { startingMoney: 2000 } }));
            for (const pid of newState.playerOrder) {
                (0, vitest_1.expect)(newState.players[pid]?.money).toBe(2000);
            }
        });
        (0, vitest_1.it)('sets goReward from MapConfig.bank.goReward', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.settings.goReward).toBe(200);
        });
        (0, vitest_1.it)('sets auctionDurationSeconds from MapConfig auctionConfig', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.settings.auctionDurationSeconds).toBe(30);
        });
        (0, vitest_1.it)('sets maxPlayers to player count when not overridden', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.settings.maxPlayers).toBe(2);
        });
        (0, vitest_1.it)('sets disconnectedPlayerPolicy to SKIP by default', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.settings.disconnectedPlayerPolicy).toBe(shared_1.DisconnectedPlayerPolicy.SKIP);
        });
    });
    // ---------------------------------------------------------------------------
    // 8-Player Game
    // ---------------------------------------------------------------------------
    (0, vitest_1.describe)('8-player game', () => {
        let result;
        (0, vitest_1.beforeEach)(() => {
            result = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ players: createTestPlayers(8) }));
        });
        (0, vitest_1.it)('creates playerOrder with 8 entries', () => {
            (0, vitest_1.expect)(result.newState.playerOrder).toHaveLength(8);
        });
        (0, vitest_1.it)('creates a PlayerState for all 8 players', () => {
            (0, vitest_1.expect)(Object.keys(result.newState.players)).toHaveLength(8);
        });
        (0, vitest_1.it)('starts all 8 players at position 0', () => {
            for (const pid of result.newState.playerOrder) {
                (0, vitest_1.expect)(result.newState.players[pid]?.position).toBe(0);
            }
        });
        (0, vitest_1.it)('gives all 8 players 1500 starting money', () => {
            for (const pid of result.newState.playerOrder) {
                (0, vitest_1.expect)(result.newState.players[pid]?.money).toBe(1500);
            }
        });
        (0, vitest_1.it)('preserves the input player order (not sorted or shuffled)', () => {
            const players = createTestPlayers(8);
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ players }));
            for (let i = 0; i < 8; i++) {
                (0, vitest_1.expect)(newState.playerOrder[i]).toBe(players[i].playerId);
            }
        });
        (0, vitest_1.it)('sets turn to the first player in the 8-player order', () => {
            (0, vitest_1.expect)(result.newState.turn.currentPlayerId).toBe('player-1');
        });
        (0, vitest_1.it)('has a turnExpiresAt set 120 seconds after createdAt', () => {
            const createdAt = 1_750_000_000_000;
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ players: createTestPlayers(8), createdAt }));
            (0, vitest_1.expect)(newState.turn.turnExpiresAt).toBe(createdAt + 120_000);
        });
    });
    // ---------------------------------------------------------------------------
    // Deterministic RNG
    // ---------------------------------------------------------------------------
    (0, vitest_1.describe)('deterministic RNG', () => {
        (0, vitest_1.it)('produces the same RNGState for the same seed and gameId', () => {
            const rng1 = DiceEngine_js_1.DiceEngine.createRNGState('my-seed', 'game-001');
            const rng2 = DiceEngine_js_1.DiceEngine.createRNGState('my-seed', 'game-001');
            (0, vitest_1.expect)(rng1).toEqual(rng2);
        });
        (0, vitest_1.it)('produces different RNGStates for different seeds', () => {
            const rng1 = DiceEngine_js_1.DiceEngine.createRNGState('seed-A', 'game-001');
            const rng2 = DiceEngine_js_1.DiceEngine.createRNGState('seed-B', 'game-001');
            (0, vitest_1.expect)(rng1).not.toEqual(rng2);
        });
        (0, vitest_1.it)('produces different RNGStates for the same seed but different gameIds', () => {
            const rng1 = DiceEngine_js_1.DiceEngine.createRNGState('shared-seed', 'game-001');
            const rng2 = DiceEngine_js_1.DiceEngine.createRNGState('shared-seed', 'game-002');
            (0, vitest_1.expect)(rng1).not.toEqual(rng2);
        });
        (0, vitest_1.it)('stores the seed string in the returned RNGState', () => {
            const seed = 'track-me-seed';
            const rng = DiceEngine_js_1.DiceEngine.createRNGState(seed, 'game-001');
            (0, vitest_1.expect)(rng.seed).toBe(seed);
        });
        (0, vitest_1.it)('initialises the RNG counter at 0', () => {
            const rng = DiceEngine_js_1.DiceEngine.createRNGState('any-seed', 'game-001');
            (0, vitest_1.expect)(rng.counter).toBe(0);
        });
    });
    // ---------------------------------------------------------------------------
    // Deterministic Deck Shuffling
    // ---------------------------------------------------------------------------
    (0, vitest_1.describe)('deterministic deck shuffling', () => {
        (0, vitest_1.it)('produces identical Chance deck order for the same seed', () => {
            const seed = 'shuffle-seed-xyz';
            const p1 = createBaseParams({ rngSeed: seed, gameId: 'game-001' });
            const p2 = createBaseParams({ rngSeed: seed, gameId: 'game-001' });
            const { newState: s1 } = GameEngine_js_1.GameEngine.createInitialState(p1);
            const { newState: s2 } = GameEngine_js_1.GameEngine.createInitialState(p2);
            (0, vitest_1.expect)(s1.cardDecks.chance).toEqual(s2.cardDecks.chance);
        });
        (0, vitest_1.it)('produces identical Community Chest deck order for the same seed', () => {
            const seed = 'shuffle-seed-xyz';
            const p1 = createBaseParams({ rngSeed: seed, gameId: 'game-001' });
            const p2 = createBaseParams({ rngSeed: seed, gameId: 'game-001' });
            const { newState: s1 } = GameEngine_js_1.GameEngine.createInitialState(p1);
            const { newState: s2 } = GameEngine_js_1.GameEngine.createInitialState(p2);
            (0, vitest_1.expect)(s1.cardDecks.communityChest).toEqual(s2.cardDecks.communityChest);
        });
        (0, vitest_1.it)('produces different Chance deck order for different seeds (with very high probability)', () => {
            // With 6 cards, there are 720 possible orderings.
            // Probability of collision ≈ 1/720 ≈ 0.14% — negligible.
            const p1 = createBaseParams({ rngSeed: 'seed-ALPHA-1111', gameId: 'game-001' });
            const p2 = createBaseParams({ rngSeed: 'seed-BETA-2222', gameId: 'game-001' });
            const { newState: s1 } = GameEngine_js_1.GameEngine.createInitialState(p1);
            const { newState: s2 } = GameEngine_js_1.GameEngine.createInitialState(p2);
            (0, vitest_1.expect)(s1.cardDecks.chance).not.toEqual(s2.cardDecks.chance);
        });
        (0, vitest_1.it)('produces different Community Chest deck order for different seeds', () => {
            const p1 = createBaseParams({ rngSeed: 'seed-ALPHA-1111', gameId: 'game-001' });
            const p2 = createBaseParams({ rngSeed: 'seed-BETA-2222', gameId: 'game-001' });
            const { newState: s1 } = GameEngine_js_1.GameEngine.createInitialState(p1);
            const { newState: s2 } = GameEngine_js_1.GameEngine.createInitialState(p2);
            (0, vitest_1.expect)(s1.cardDecks.communityChest).not.toEqual(s2.cardDecks.communityChest);
        });
        (0, vitest_1.it)('preserves all card IDs — no cards added or lost during shuffle', () => {
            const mapConfig = createTestMapConfig();
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ mapConfig }));
            const expectedChanceIds = mapConfig.cards.chance.map(c => c.id).sort();
            const expectedCcIds = mapConfig.cards.communityChest.map(c => c.id).sort();
            (0, vitest_1.expect)([...newState.cardDecks.chance].sort()).toEqual(expectedChanceIds);
            (0, vitest_1.expect)([...newState.cardDecks.communityChest].sort()).toEqual(expectedCcIds);
        });
        (0, vitest_1.it)('advances the RNG counter — rngState.counter > 0 after deck shuffling', () => {
            // Deck shuffling consumes PRNG steps; the counter should be > 0.
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.rngState.counter).toBeGreaterThan(0);
        });
    });
    // ---------------------------------------------------------------------------
    // Full Determinism — Identical Seed → Identical GameState
    // ---------------------------------------------------------------------------
    (0, vitest_1.describe)('full determinism', () => {
        (0, vitest_1.it)('identical params produce byte-for-byte identical GameState', () => {
            const params = createBaseParams({
                rngSeed: 'full-determinism-seed',
                gameId: 'game-determinism-001',
            });
            const { newState: s1 } = GameEngine_js_1.GameEngine.createInitialState(params);
            const { newState: s2 } = GameEngine_js_1.GameEngine.createInitialState(params);
            (0, vitest_1.expect)(s1).toEqual(s2);
        });
        (0, vitest_1.it)('identical params produce identical checksums', () => {
            const params = createBaseParams({
                rngSeed: 'checksum-seed',
                gameId: 'game-checksum-001',
            });
            const { newState: s1 } = GameEngine_js_1.GameEngine.createInitialState(params);
            const { newState: s2 } = GameEngine_js_1.GameEngine.createInitialState(params);
            (0, vitest_1.expect)(s1.checksum).toBe(s2.checksum);
        });
        (0, vitest_1.it)('identical params produce identical GAME_STARTED event IDs', () => {
            const params = createBaseParams({
                rngSeed: 'event-id-seed',
                gameId: 'game-event-001',
            });
            const r1 = GameEngine_js_1.GameEngine.createInitialState(params);
            const r2 = GameEngine_js_1.GameEngine.createInitialState(params);
            (0, vitest_1.expect)(r1.events[0]?.id).toBe(r2.events[0]?.id);
        });
        (0, vitest_1.it)('different gameIds with the same seed produce different states', () => {
            const seed = 'same-seed-different-game';
            const r1 = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ rngSeed: seed, gameId: 'game-A' }));
            const r2 = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ rngSeed: seed, gameId: 'game-B' }));
            // The state IDs must differ (trivially).
            (0, vitest_1.expect)(r1.newState.id).not.toBe(r2.newState.id);
            // Because DiceEngine.createRNGState mixes in gameId as a salt, the
            // PRNG sequences diverge and deck orders differ.
            // NOTE: The checksum covers gameplay fields only (money, positions, board)
            //       which are identical at init regardless of gameId — only the
            //       card deck order differs at the RNG level.
            (0, vitest_1.expect)(r1.newState.cardDecks.chance).not.toEqual(r2.newState.cardDecks.chance);
        });
    });
    // ---------------------------------------------------------------------------
    // Checksum Generation
    // ---------------------------------------------------------------------------
    (0, vitest_1.describe)('checksum generation', () => {
        (0, vitest_1.it)('checksum is a non-empty string', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(typeof newState.checksum).toBe('string');
            (0, vitest_1.expect)(newState.checksum.length).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('checksum is a 64-character lowercase hex string (SHA-256 output)', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.checksum).toMatch(/^[0-9a-f]{64}$/);
        });
        (0, vitest_1.it)('verifyChecksum returns true for a freshly created state', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(GameEngine_js_1.GameEngine.verifyChecksum(newState)).toBe(true);
        });
        (0, vitest_1.it)('computeChecksum is idempotent — same state → same checksum', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            const c1 = GameEngine_js_1.GameEngine.computeChecksum(newState);
            const c2 = GameEngine_js_1.GameEngine.computeChecksum(newState);
            (0, vitest_1.expect)(c1).toBe(c2);
        });
        (0, vitest_1.it)('checksum changes when player money changes', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            const original = GameEngine_js_1.GameEngine.computeChecksum(newState);
            // Simulate money change (direct object mutation for test purposes only)
            const pid = newState.playerOrder[0];
            const mutated = {
                ...newState,
                players: {
                    ...newState.players,
                    [pid]: { ...newState.players[pid], money: 9999 },
                },
            };
            const mutatedChecksum = GameEngine_js_1.GameEngine.computeChecksum(mutated);
            (0, vitest_1.expect)(mutatedChecksum).not.toBe(original);
        });
        (0, vitest_1.it)('checksum changes when tile ownership changes', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            const original = GameEngine_js_1.GameEngine.computeChecksum(newState);
            const tileId = 'mediterranean-avenue';
            const mutated = {
                ...newState,
                board: {
                    tiles: {
                        ...newState.board.tiles,
                        [tileId]: { ...newState.board.tiles[tileId], ownerId: 'player-1' },
                    },
                },
            };
            const mutatedChecksum = GameEngine_js_1.GameEngine.computeChecksum(mutated);
            (0, vitest_1.expect)(mutatedChecksum).not.toBe(original);
        });
        (0, vitest_1.it)('checksum changes when bank houses count changes', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            const original = GameEngine_js_1.GameEngine.computeChecksum(newState);
            const mutated = {
                ...newState,
                bank: { ...newState.bank, houses: 31 }, // 1 house sold
            };
            const mutatedChecksum = GameEngine_js_1.GameEngine.computeChecksum(mutated);
            (0, vitest_1.expect)(mutatedChecksum).not.toBe(original);
        });
        (0, vitest_1.it)('checksum does NOT change when only eventLog changes (cosmetic field)', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            const original = GameEngine_js_1.GameEngine.computeChecksum(newState);
            // Append a fake log entry — should not affect checksum
            const mutated = {
                ...newState,
                eventLog: [
                    ...newState.eventLog,
                    { id: 'extra', type: 'FAKE_EVENT', ts: 0, payload: {} },
                ],
            };
            const afterAppend = GameEngine_js_1.GameEngine.computeChecksum(mutated);
            (0, vitest_1.expect)(afterAppend).toBe(original);
        });
        (0, vitest_1.it)('verifyChecksum returns false when the stored checksum is stale', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            // Tamper with state without recomputing checksum
            const tampered = {
                ...newState,
                bank: { ...newState.bank, houses: 0 },
                // checksum still reflects the original state
            };
            (0, vitest_1.expect)(GameEngine_js_1.GameEngine.verifyChecksum(tampered)).toBe(false);
        });
    });
    // ---------------------------------------------------------------------------
    // GAME_STARTED Event
    // ---------------------------------------------------------------------------
    (0, vitest_1.describe)('GAME_STARTED event', () => {
        (0, vitest_1.it)('emits exactly 1 event', () => {
            const { events } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(events).toHaveLength(1);
        });
        (0, vitest_1.it)('emits a GAME_STARTED event', () => {
            const { events } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(events[0]?.type).toBe(shared_1.EventType.GAME_STARTED);
        });
        (0, vitest_1.it)('GAME_STARTED event has the correct roomId', () => {
            const { events } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(events[0]?.roomId).toBe('room-test-001');
        });
        (0, vitest_1.it)('GAME_STARTED event has the correct gameId', () => {
            const { events } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(events[0]?.gameId).toBe('game-test-001');
        });
        (0, vitest_1.it)('GAME_STARTED event has audience type ALL', () => {
            const { events } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(events[0]?.audience.type).toBe('ALL');
        });
        (0, vitest_1.it)('GAME_STARTED payload contains correct playerOrder', () => {
            const players = createTestPlayers(3);
            const { events } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ players }));
            const payload = events[0]?.payload;
            (0, vitest_1.expect)(payload.playerOrder).toEqual(['player-1', 'player-2', 'player-3']);
        });
        (0, vitest_1.it)('GAME_STARTED payload startingPositions has 0 for all players', () => {
            const players = createTestPlayers(2);
            const { events } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ players }));
            const payload = events[0]?.payload;
            (0, vitest_1.expect)(payload.startingPositions['player-1']).toBe(0);
            (0, vitest_1.expect)(payload.startingPositions['player-2']).toBe(0);
        });
        (0, vitest_1.it)('GAME_STARTED payload startingMoney reflects configured amount', () => {
            const { events } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            const payload = events[0]?.payload;
            (0, vitest_1.expect)(payload.startingMoney['player-1']).toBe(1500);
        });
        (0, vitest_1.it)('GAME_STARTED event is also recorded in eventLog', () => {
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(newState.eventLog).toHaveLength(1);
            (0, vitest_1.expect)(newState.eventLog[0]?.type).toBe(shared_1.EventType.GAME_STARTED);
        });
        (0, vitest_1.it)('GAME_STARTED event ID in events matches eventLog entry', () => {
            const { newState, events } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams());
            (0, vitest_1.expect)(events[0]?.id).toBe(newState.eventLog[0]?.id);
        });
    });
    // ---------------------------------------------------------------------------
    // Guard Conditions
    // ---------------------------------------------------------------------------
    (0, vitest_1.describe)('guard conditions', () => {
        (0, vitest_1.it)('throws when fewer than 2 players are provided', () => {
            (0, vitest_1.expect)(() => GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ players: createTestPlayers(1) }))).toThrow('At least 2 players are required');
        });
        (0, vitest_1.it)('throws when more than 8 players are provided', () => {
            (0, vitest_1.expect)(() => GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ players: createTestPlayers(9) }))).toThrow('Maximum 8 players supported');
        });
        (0, vitest_1.it)('generates a random seed when rngSeed is not provided', () => {
            // Two calls without explicit seed should produce different deck orders
            // (astronomically unlikely to be the same)
            const p1 = createBaseParams({ rngSeed: undefined });
            const p2 = createBaseParams({ rngSeed: undefined });
            const { newState: s1 } = GameEngine_js_1.GameEngine.createInitialState(p1);
            const { newState: s2 } = GameEngine_js_1.GameEngine.createInitialState(p2);
            // Different seeds → different RNG starting points → different deck order
            (0, vitest_1.expect)(s1.cardDecks.chance).not.toEqual(s2.cardDecks.chance);
        });
    });
    // ---------------------------------------------------------------------------
    // Timing
    // ---------------------------------------------------------------------------
    (0, vitest_1.describe)('timing fields', () => {
        (0, vitest_1.it)('sets createdAt from params', () => {
            const createdAt = 1_700_000_000_000;
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ createdAt }));
            (0, vitest_1.expect)(newState.createdAt).toBe(createdAt);
        });
        (0, vitest_1.it)('sets lastActionAt equal to createdAt at initialisation', () => {
            const createdAt = 1_700_000_000_000;
            const { newState } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ createdAt }));
            (0, vitest_1.expect)(newState.lastActionAt).toBe(createdAt);
        });
        (0, vitest_1.it)('sets GAME_STARTED event ts equal to createdAt', () => {
            const createdAt = 1_700_000_000_000;
            const { events } = GameEngine_js_1.GameEngine.createInitialState(createBaseParams({ createdAt }));
            (0, vitest_1.expect)(events[0]?.ts).toBe(createdAt);
        });
    });
});
//# sourceMappingURL=GameEngine.createInitialState.test.js.map