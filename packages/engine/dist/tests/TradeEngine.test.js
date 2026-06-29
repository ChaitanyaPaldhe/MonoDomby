"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const shared_1 = require("@monopoly/shared");
const TradeEngine_js_1 = require("../../../src/engine/TradeEngine.js");
const errors_js_1 = require("../../../src/engine/errors.js");
const TradePlanner_js_1 = require("../../../src/engine/TradePlanner.js");
(0, vitest_1.describe)('TradeEngine', () => {
    let config;
    let state;
    let p1;
    let p2;
    let engine;
    (0, vitest_1.beforeEach)(() => {
        p1 = 'player1';
        p2 = 'player2';
        config = {
            schemaVersion: '1.0',
            meta: { id: 'test', name: 'Test', playerTokens: [] },
            bank: { startingMoney: 1500, infiniteMoney: true, initialHouses: 32, initialHotels: 12, goReward: 200 },
            board: { size: 40, jailTileIndex: 10, tiles: [] },
            cards: [],
            rules: {}
        };
        state = {
            id: 'game1',
            roomId: 'room1',
            version: 1,
            phase: shared_1.GamePhase.IN_PROGRESS,
            settings: config.bank,
            turn: {
                turnNumber: 1,
                currentPlayerId: p1,
                phase: shared_1.TurnPhase.POST_ROLL,
                diceValues: [1, 2],
                isDoubles: false,
                consecutiveDoubles: 0,
                pendingDecision: null
            },
            players: {
                [p1]: { id: p1, tokenUrl: '', money: 1500, netWorth: 1500, position: 0, properties: [], getOutOfJailCards: 0, getOutOfJailCardsList: [], jailState: null, bankruptedAt: null },
                [p2]: { id: p2, tokenUrl: '', money: 1500, netWorth: 1500, position: 0, properties: [], getOutOfJailCards: 0, getOutOfJailCardsList: [], jailState: null, bankruptedAt: null },
            },
            bank: { money: Number.MAX_SAFE_INTEGER, houses: 32, hotels: 12 },
            board: { tiles: {} },
            activeTrades: {},
            checksum: ''
        };
        engine = new TradeEngine_js_1.TradeEngine();
    });
    (0, vitest_1.describe)('TradePlanner.validateTradeOffer', () => {
        (0, vitest_1.it)('throws if money exceeds player money', () => {
            const offer = { money: state.players[p1].money + 1, properties: [], jailCards: 0 };
            (0, vitest_1.expect)(() => TradePlanner_js_1.TradePlanner.validateTradeOffer(offer, state, p1, config))
                .toThrowError(errors_js_1.EngineValidationError);
        });
        (0, vitest_1.it)('throws if offering properties with buildings', () => {
            const propId = 'p1-prop';
            state.players[p1].properties.push(propId);
            state.board.tiles[propId] = { tileId: propId, ownerId: p1, houses: 1, hasHotel: false, isMortgaged: false };
            const offer = { money: 0, properties: [propId], jailCards: 0 };
            (0, vitest_1.expect)(() => TradePlanner_js_1.TradePlanner.validateTradeOffer(offer, state, p1, config))
                .toThrowError(/buildings/);
        });
    });
    (0, vitest_1.describe)('Trade Execution', () => {
        (0, vitest_1.it)('executes a cash for property swap', () => {
            const propId = 'p1-prop';
            state.players[p1].properties.push(propId);
            state.board.tiles[propId] = { tileId: propId, ownerId: p1, houses: 0, hasHotel: false, isMortgaged: false };
            const offer = { money: 0, properties: [propId], jailCards: 0 };
            const request = { money: 100, properties: [], jailCards: 0 };
            const propRes = engine.proposeTrade(state, p1, p2, offer, request, config, 1, 'act1', 100);
            const activeTrade = Object.values(propRes.newState.activeTrades)[0];
            const accRes = engine.acceptTrade(propRes.newState, p2, activeTrade.id, config, 'act2', 200);
            const accState = accRes.newState;
            (0, vitest_1.expect)(accState.players[p1].money).toBe(state.players[p1].money + 100);
            (0, vitest_1.expect)(accState.players[p2].money).toBe(state.players[p2].money - 100);
            (0, vitest_1.expect)(accState.players[p1].properties).not.toContain(propId);
            (0, vitest_1.expect)(accState.players[p2].properties).toContain(propId);
            (0, vitest_1.expect)(accState.board.tiles[propId].ownerId).toBe(p2);
        });
        (0, vitest_1.it)('handles mortgaged properties and transfer fees', () => {
            config.bank.infiniteMoney = false;
            state.bank.money = 10000;
            const propId = 'p1-prop';
            state.players[p1].properties.push(propId);
            state.board.tiles[propId] = { tileId: propId, ownerId: p1, houses: 0, hasHotel: false, isMortgaged: true };
            // Add tile definition
            config.board.tiles.push({ id: propId, type: 'PROPERTY', propertyData: { price: 200, mortgageValue: 100 } });
            const offer = { money: 0, properties: [propId], jailCards: 0 };
            const request = { money: 50, properties: [], jailCards: 0 };
            const propRes = engine.proposeTrade(state, p1, p2, offer, request, config, 1, 'act1', 100);
            const activeTrade = Object.values(propRes.newState.activeTrades)[0];
            const accRes = engine.acceptTrade(propRes.newState, p2, activeTrade.id, config, 'act2', 200);
            const accState = accRes.newState;
            // target p2 receives prop, pays 50 to p1, pays 10% fee (10)
            (0, vitest_1.expect)(accState.players[p2].money).toBe(state.players[p2].money - 50 - 10);
            (0, vitest_1.expect)(accState.players[p1].money).toBe(state.players[p1].money + 50);
            (0, vitest_1.expect)(accState.players[p2].properties).toContain(propId);
            (0, vitest_1.expect)(accState.bank.money).toBe(state.bank.money + 10);
        });
        (0, vitest_1.it)('rejects trade if it would bankrupt the non-active player via mortgage fee', () => {
            const propId = 'p1-prop';
            state.players[p1].properties.push(propId);
            state.board.tiles[propId] = { tileId: propId, ownerId: p1, houses: 0, hasHotel: false, isMortgaged: true };
            config.board.tiles.push({ id: propId, type: 'PROPERTY', propertyData: { price: 2000, mortgageValue: 1000 } });
            const offer = { money: 0, properties: [propId], jailCards: 0 };
            const request = { money: 0, properties: [], jailCards: 0 };
            // Make p2 broke, they cannot pay the 100 mortgage fee.
            state.players[p2].money = 50;
            state.turn.currentPlayerId = p1; // Current player is p1, p2 is receiving
            const propRes = engine.proposeTrade(state, p1, p2, offer, request, config, 1, 'act1', 100);
            const activeTrade = Object.values(propRes.newState.activeTrades)[0];
            // Try to accept, should fail because p2 isn't current player and enters debt recovery
            (0, vitest_1.expect)(() => engine.acceptTrade(propRes.newState, p2, activeTrade.id, config, 'act2', 200))
                .toThrowError(/non-active player to enter Debt Recovery/);
        });
    });
});
//# sourceMappingURL=TradeEngine.test.js.map