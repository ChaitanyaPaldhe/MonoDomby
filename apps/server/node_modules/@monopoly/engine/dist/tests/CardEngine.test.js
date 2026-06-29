"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const CardEngine_js_1 = require("../../../src/engine/CardEngine.js");
const CardEffectRegistry_js_1 = require("../../../src/engine/CardEffectRegistry.js");
const TileResolver_js_1 = require("../../../src/engine/TileResolver.js");
const shared_1 = require("@monopoly/shared");
const errors_js_1 = require("../../../src/engine/errors.js");
(0, vitest_1.describe)('CardEngine', () => {
    let engine;
    let registry;
    let tileResolver;
    let mockState;
    let mockMapConfig;
    let mockAction;
    (0, vitest_1.beforeEach)(() => {
        registry = new CardEffectRegistry_js_1.CardEffectRegistry();
        engine = new CardEngine_js_1.CardEngine(registry);
        tileResolver = new TileResolver_js_1.TileResolver();
        mockAction = {
            actionId: 'test-action-123',
            type: 'APPLY_CARD',
            roomId: 'room-1',
            clientTs: 1000,
            payload: {},
        };
        mockMapConfig = {
            meta: { id: 'test-map' },
            cards: {
                chance: [
                    {
                        id: 'chance-1',
                        text: 'Test Chance Card',
                        effect: { type: shared_1.CardEffectType.COLLECT_FROM_BANK, amount: 100 }
                    }
                ],
                communityChest: []
            }
        };
        mockState = {
            id: 'game-1',
            version: 1,
            phase: shared_1.GamePhase.IN_PROGRESS,
            pendingCard: {
                cardId: 'chance-1',
                deckType: shared_1.CardDeckType.CHANCE,
                playerId: 'player-1',
                drawSequence: 1,
                timestamp: 1000,
                removedFromDeck: false,
            },
            turn: {
                currentPlayerId: 'player-1',
                phase: shared_1.TurnPhase.CARD_DRAWN,
            },
            players: {
                'player-1': { money: 1500 }
            }
        };
    });
    (0, vitest_1.it)('throws EngineStateCorruptionError if GameState has no pendingCard', () => {
        mockState = { ...mockState, pendingCard: null };
        (0, vitest_1.expect)(() => engine.executeCard(mockState, mockAction, mockMapConfig, 'player-1', tileResolver))
            .toThrow(errors_js_1.EngineStateCorruptionError);
    });
    (0, vitest_1.it)('throws EngineStateCorruptionError if actingPlayerId does not match pendingCard.playerId', () => {
        (0, vitest_1.expect)(() => engine.executeCard(mockState, mockAction, mockMapConfig, 'player-2', tileResolver))
            .toThrow(errors_js_1.EngineStateCorruptionError);
    });
    (0, vitest_1.it)('dispatches to the correct registry handler', () => {
        const mockHandler = vitest_1.vi.fn().mockReturnValue({ newState: mockState, events: [] });
        registry.register(shared_1.CardEffectType.COLLECT_FROM_BANK, mockHandler);
        engine.executeCard(mockState, mockAction, mockMapConfig, 'player-1', tileResolver);
        (0, vitest_1.expect)(mockHandler).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(mockHandler).toHaveBeenCalledWith(mockState, mockMapConfig.cards.chance[0], 'player-1', mockMapConfig, mockAction, tileResolver);
    });
    (0, vitest_1.it)('clears pendingCard and emits CARD_APPLIED after execution', () => {
        const mockHandler = vitest_1.vi.fn().mockReturnValue({
            newState: { ...mockState, someChangedProp: true },
            events: [{ type: 'MOCK_EVENT' }]
        });
        registry.register(shared_1.CardEffectType.COLLECT_FROM_BANK, mockHandler);
        const result = engine.executeCard(mockState, mockAction, mockMapConfig, 'player-1', tileResolver);
        (0, vitest_1.expect)(result.newState.pendingCard).toBeNull();
        (0, vitest_1.expect)(result.events.length).toBe(2);
        (0, vitest_1.expect)(result.events[0].type).toBe(shared_1.EventType.CARD_APPLIED);
        (0, vitest_1.expect)(result.events[0].payload.cardId).toBe('chance-1');
        (0, vitest_1.expect)(result.events[1].type).toBe('MOCK_EVENT');
    });
    (0, vitest_1.it)('supports custom handlers', () => {
        mockMapConfig.cards.chance[0].effect = { type: shared_1.CardEffectType.CUSTOM, customHandler: 'my-custom-handler' };
        const customHandler = vitest_1.vi.fn().mockReturnValue({ newState: mockState, events: [] });
        registry.registerCustom('my-custom-handler', customHandler);
        engine.executeCard(mockState, mockAction, mockMapConfig, 'player-1', tileResolver);
        (0, vitest_1.expect)(customHandler).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=CardEngine.test.js.map