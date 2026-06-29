"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const RentCalculator_js_1 = require("../../../src/engine/RentCalculator.js");
const shared_1 = require("@monopoly/shared");
(0, vitest_1.describe)('RentCalculator', () => {
    const PLAYER_1 = 'player-1';
    const PLAYER_2 = 'player-2';
    const mockAction = {
        actionId: 'test-action-id',
        clientTs: 1234567890,
        type: 'ROLL_DICE',
        payload: {},
    };
    const mapConfig = {
        meta: { id: 'test-map' },
        board: {
            tiles: [
                {
                    id: 'prop-1',
                    type: 'PROPERTY',
                    index: 0,
                    propertyData: {
                        groupId: 'group-1',
                        price: 100,
                        buildingCost: 50,
                        rents: { base: 10, colorGroup: 20, oneHouse: 50, twoHouses: 150, threeHouses: 450, fourHouses: 625, hotel: 750 },
                    },
                },
                {
                    id: 'prop-2',
                    type: 'PROPERTY',
                    index: 1,
                    propertyData: {
                        groupId: 'group-1',
                        price: 100,
                        buildingCost: 50,
                        rents: { base: 12, colorGroup: 24, oneHouse: 60, twoHouses: 180, threeHouses: 500, fourHouses: 700, hotel: 900 },
                    },
                },
                {
                    id: 'rr-1',
                    type: 'RAILROAD',
                    index: 2,
                    railroadData: {
                        price: 200,
                        rents: [25, 50, 100, 200],
                    },
                },
                {
                    id: 'rr-2',
                    type: 'RAILROAD',
                    index: 3,
                    railroadData: {
                        price: 200,
                        rents: [25, 50, 100, 200],
                    },
                },
                {
                    id: 'util-1',
                    type: 'UTILITY',
                    index: 4,
                    utilityData: {
                        price: 150,
                        diceMultipliers: [4, 10],
                    },
                },
                {
                    id: 'util-2',
                    type: 'UTILITY',
                    index: 5,
                    utilityData: {
                        price: 150,
                        diceMultipliers: [4, 10],
                    },
                },
            ],
        },
    };
    const getInitialState = () => ({
        id: 'game-1',
        roomId: 'room-1',
        version: 1,
        checksum: '',
        createdAt: 0,
        lastActionAt: 0,
        settings: {},
        eventLog: [],
        rngState: {},
        players: {
            [PLAYER_1]: {
                playerId: PLAYER_1,
                position: 0,
                money: 1500,
                properties: [],
                jailState: null,
                getOutOfJailCards: 0,
                isBankrupt: false,
            },
            [PLAYER_2]: {
                playerId: PLAYER_2,
                position: 0,
                money: 1500,
                properties: [],
                jailState: null,
                getOutOfJailCards: 0,
                isBankrupt: false,
            },
        },
        playerOrder: [PLAYER_1, PLAYER_2],
        board: {
            tiles: {
                'prop-1': { ownerId: PLAYER_2, isMortgaged: false, houses: 0, hasHotel: false },
                'prop-2': { ownerId: null, isMortgaged: false, houses: 0, hasHotel: false },
                'rr-1': { ownerId: PLAYER_2, isMortgaged: false, houses: 0, hasHotel: false },
                'rr-2': { ownerId: null, isMortgaged: false, houses: 0, hasHotel: false },
                'util-1': { ownerId: PLAYER_2, isMortgaged: false, houses: 0, hasHotel: false },
                'util-2': { ownerId: null, isMortgaged: false, houses: 0, hasHotel: false },
            },
        },
        bank: {
            money: 10000,
            houses: 32,
            hotels: 12,
            freeParkingPot: 0,
        },
        turn: {
            currentPlayerId: PLAYER_1,
            turnNumber: 1,
            phase: shared_1.TurnPhase.ROLLED,
            diceValues: [3, 4], // Total 7
            isDoubles: false,
            consecutiveDoubles: 0,
            turnExpiresAt: 0,
            pendingDecision: null,
        },
        decks: {},
        activeTrades: {},
        auction: null,
    });
    (0, vitest_1.describe)('Property Rent', () => {
        (0, vitest_1.it)('charges base rent for an unmonopolised property without houses', () => {
            const state = getInitialState();
            const result = RentCalculator_js_1.RentCalculator.processRent(state, mapConfig.board.tiles[0], mapConfig, mockAction, PLAYER_1);
            (0, vitest_1.expect)(result.newState.players[PLAYER_1]?.money).toBe(1500 - 10);
            (0, vitest_1.expect)(result.newState.players[PLAYER_2]?.money).toBe(1500 + 10);
            const calcEvent = result.events.find(e => e.type === shared_1.EventType.RENT_CALCULATED);
            (0, vitest_1.expect)(calcEvent).toBeDefined();
            (0, vitest_1.expect)(calcEvent?.payload.amount).toBe(10);
            const paidEvent = result.events.find(e => e.type === shared_1.EventType.RENT_PAID);
            (0, vitest_1.expect)(paidEvent).toBeDefined();
            (0, vitest_1.expect)(paidEvent?.payload.amount).toBe(10);
            (0, vitest_1.expect)(paidEvent?.payload.payerId).toBe(PLAYER_1);
            (0, vitest_1.expect)(paidEvent?.payload.payeeId).toBe(PLAYER_2);
            (0, vitest_1.expect)(paidEvent?.payload.tileId).toBe('prop-1');
        });
        (0, vitest_1.it)('charges double rent for a monopolised property with no houses', () => {
            const state = getInitialState();
            // P2 owns both properties in group-1
            state.board.tiles['prop-2'].ownerId = PLAYER_2;
            const result = RentCalculator_js_1.RentCalculator.processRent(state, mapConfig.board.tiles[0], mapConfig, mockAction, PLAYER_1);
            (0, vitest_1.expect)(result.newState.players[PLAYER_1]?.money).toBe(1500 - 20); // 10 * 2
            (0, vitest_1.expect)(result.newState.players[PLAYER_2]?.money).toBe(1500 + 20);
        });
        (0, vitest_1.it)('charges rent based on houses', () => {
            const state = getInitialState();
            state.board.tiles['prop-2'].ownerId = PLAYER_2; // Monopoly
            state.board.tiles['prop-1'].houses = 2; // 2 houses -> rent is 150
            const result = RentCalculator_js_1.RentCalculator.processRent(state, mapConfig.board.tiles[0], mapConfig, mockAction, PLAYER_1);
            // Even with monopoly, if there are houses, we use the house rent table directly
            (0, vitest_1.expect)(result.newState.players[PLAYER_1]?.money).toBe(1500 - 150);
            (0, vitest_1.expect)(result.newState.players[PLAYER_2]?.money).toBe(1500 + 150);
        });
        (0, vitest_1.it)('charges rent based on a hotel', () => {
            const state = getInitialState();
            state.board.tiles['prop-1'].houses = 0;
            state.board.tiles['prop-1'].hasHotel = true; // rent is 750
            const result = RentCalculator_js_1.RentCalculator.processRent(state, mapConfig.board.tiles[0], mapConfig, mockAction, PLAYER_1);
            (0, vitest_1.expect)(result.newState.players[PLAYER_1]?.money).toBe(1500 - 750);
            (0, vitest_1.expect)(result.newState.players[PLAYER_2]?.money).toBe(1500 + 750);
        });
    });
    (0, vitest_1.describe)('Railroad Rent', () => {
        (0, vitest_1.it)('charges 25 for 1 railroad', () => {
            const state = getInitialState();
            const result = RentCalculator_js_1.RentCalculator.processRent(state, mapConfig.board.tiles[2], mapConfig, mockAction, PLAYER_1);
            (0, vitest_1.expect)(result.newState.players[PLAYER_1]?.money).toBe(1500 - 25);
        });
        (0, vitest_1.it)('charges 50 for 2 railroads', () => {
            const state = getInitialState();
            state.board.tiles['rr-2'].ownerId = PLAYER_2; // Owns both
            const result = RentCalculator_js_1.RentCalculator.processRent(state, mapConfig.board.tiles[2], mapConfig, mockAction, PLAYER_1);
            (0, vitest_1.expect)(result.newState.players[PLAYER_1]?.money).toBe(1500 - 50);
        });
    });
    (0, vitest_1.describe)('Utility Rent', () => {
        (0, vitest_1.it)('charges 4x dice roll for 1 utility', () => {
            const state = getInitialState();
            const result = RentCalculator_js_1.RentCalculator.processRent(state, mapConfig.board.tiles[4], mapConfig, mockAction, PLAYER_1);
            // Dice roll is 7. 7 * 4 = 28
            (0, vitest_1.expect)(result.newState.players[PLAYER_1]?.money).toBe(1500 - 28);
        });
        (0, vitest_1.it)('charges 10x dice roll for 2 utilities', () => {
            const state = getInitialState();
            state.board.tiles['util-2'].ownerId = PLAYER_2; // Owns both
            const result = RentCalculator_js_1.RentCalculator.processRent(state, mapConfig.board.tiles[4], mapConfig, mockAction, PLAYER_1);
            // Dice roll is 7. 7 * 10 = 70
            (0, vitest_1.expect)(result.newState.players[PLAYER_1]?.money).toBe(1500 - 70);
        });
    });
    (0, vitest_1.describe)('Edge Cases & Validation', () => {
        (0, vitest_1.it)('collects no rent on mortgaged properties', () => {
            const state = getInitialState();
            state.board.tiles['prop-1'].isMortgaged = true;
            const result = RentCalculator_js_1.RentCalculator.processRent(state, mapConfig.board.tiles[0], mapConfig, mockAction, PLAYER_1);
            (0, vitest_1.expect)(result.newState.players[PLAYER_1]?.money).toBe(1500);
            (0, vitest_1.expect)(result.events).toHaveLength(0);
            (0, vitest_1.expect)(result.newState.turn.phase).toBe(shared_1.TurnPhase.POST_ROLL);
        });
        (0, vitest_1.it)('collects no rent if the owner is bankrupt', () => {
            const state = getInitialState();
            state.players[PLAYER_2].isBankrupt = true;
            const result = RentCalculator_js_1.RentCalculator.processRent(state, mapConfig.board.tiles[0], mapConfig, mockAction, PLAYER_1);
            (0, vitest_1.expect)(result.newState.players[PLAYER_1]?.money).toBe(1500);
            (0, vitest_1.expect)(result.events).toHaveLength(0);
        });
        (0, vitest_1.it)('throws if player lands on their own property', () => {
            const state = getInitialState();
            state.board.tiles['prop-1'].ownerId = PLAYER_1;
            (0, vitest_1.expect)(() => {
                RentCalculator_js_1.RentCalculator.processRent(state, mapConfig.board.tiles[0], mapConfig, mockAction, PLAYER_1);
            }).toThrow(/cannot pay rent to themselves/);
        });
        (0, vitest_1.it)('throws if property is unowned', () => {
            const state = getInitialState();
            (0, vitest_1.expect)(() => {
                RentCalculator_js_1.RentCalculator.processRent(state, mapConfig.board.tiles[1], mapConfig, mockAction, PLAYER_1); // prop-2 is unowned
            }).toThrow(/Cannot process rent for unowned tile/);
        });
    });
    (0, vitest_1.describe)('Insufficient Funds', () => {
        (0, vitest_1.it)('transitions to INSUFFICIENT_FUNDS decision if player cannot afford rent', () => {
            const state = getInitialState();
            state.players[PLAYER_1].money = 5; // Rent is 10
            const result = RentCalculator_js_1.RentCalculator.processRent(state, mapConfig.board.tiles[0], mapConfig, mockAction, PLAYER_1);
            // Money should NOT be deducted yet
            (0, vitest_1.expect)(result.newState.players[PLAYER_1]?.money).toBe(5);
            (0, vitest_1.expect)(result.newState.players[PLAYER_2]?.money).toBe(1500);
            // Should transition to pending decision
            (0, vitest_1.expect)(result.newState.turn.pendingDecision).toEqual({
                type: shared_1.DecisionType.DEBT_RECOVERY,
                creditorId: PLAYER_2,
                amountOwed: 10,
            });
            // Should emit RENT_CALCULATED and INSUFFICIENT_FUNDS
            const calcEvent = result.events.find(e => e.type === shared_1.EventType.RENT_CALCULATED);
            (0, vitest_1.expect)(calcEvent).toBeDefined();
            const insufficientEvent = result.events.find(e => e.type === shared_1.EventType.DEBT_RECOVERY_STARTED);
            (0, vitest_1.expect)(insufficientEvent).toBeDefined();
            (0, vitest_1.expect)(insufficientEvent?.payload).toEqual({
                playerId: PLAYER_1,
                creditorId: PLAYER_2,
                amountOwed: 10,
            });
            // Should NOT emit RENT_PAID
            const paidEvent = result.events.find(e => e.type === shared_1.EventType.RENT_PAID);
            (0, vitest_1.expect)(paidEvent).toBeUndefined();
        });
    });
});
//# sourceMappingURL=RentCalculator.test.js.map