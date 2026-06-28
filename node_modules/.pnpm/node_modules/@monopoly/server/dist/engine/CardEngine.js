"use strict";
// =============================================================================
// engine/CardEngine.ts
// Chance and Community Chest card subsystem.
//
// Design:
// - Card decks are stored as ordered arrays in GameState.cardDecks.
// - Drawing is deterministic: pop from front, push to discard.
// - Shuffling uses DiceEngine.shuffle() to stay PRNG-deterministic.
// - All card effects are driven by CardConfig.effect — no hardcoded effects.
// - Custom card effects are dispatched to CardHandlerRegistry.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardEngine = exports.CardHandlerRegistry = void 0;
const shared_1 = require("@monopoly/shared");
const DiceEngine_js_1 = require("./DiceEngine.js");
const errors_js_1 = require("./errors.js");
// ---------------------------------------------------------------------------
// CardHandlerRegistry
// ---------------------------------------------------------------------------
/**
 * Registry for custom card handlers (CardEffectType.CUSTOM).
 * Maps customHandler ID → handler function.
 *
 * Built-in card effects (COLLECT_FROM_BANK, MOVE_TO_TILE, etc.)
 * are handled inline by CardEngine.applyEffect — they are NOT in this registry.
 */
class CardHandlerRegistry {
    handlers = new Map();
    register(handler) {
        this.handlers.set(handler.id, handler);
        return this;
    }
    get(id) {
        return this.handlers.get(id);
    }
    has(id) {
        return this.handlers.has(id);
    }
}
exports.CardHandlerRegistry = CardHandlerRegistry;
// ---------------------------------------------------------------------------
// CardEngine
// ---------------------------------------------------------------------------
/**
 * Manages Chance and Community Chest card decks.
 *
 * All operations return new GameState — no mutation.
 */
class CardEngine {
    handlerRegistry;
    constructor(handlerRegistry = new CardHandlerRegistry()) {
        this.handlerRegistry = handlerRegistry;
    }
    // -------------------------------------------------------------------------
    // Deck Initialisation
    // -------------------------------------------------------------------------
    /**
     * Build initial shuffled CardDeckState from MapConfig.
     * Called once at game start.
     *
     * @param mapConfig - Map configuration containing card definitions.
     * @param rngState - Initial RNG state (will be advanced by shuffle).
     * @returns [CardDeckState, nextRNGState]
     */
    buildInitialDecks(mapConfig, rngState) {
        const chanceIds = mapConfig.cards.chance.map(c => c.id);
        const communityIds = mapConfig.cards.communityChest.map(c => c.id);
        const [shuffledChance, rng1] = DiceEngine_js_1.DiceEngine.shuffle(chanceIds, rngState);
        const [shuffledCommunity, rng2] = DiceEngine_js_1.DiceEngine.shuffle(communityIds, rng1);
        const decks = {
            chance: shuffledChance,
            communityChest: shuffledCommunity,
            chanceDiscard: [],
            communityChestDiscard: [],
        };
        return [decks, rng2];
    }
    // -------------------------------------------------------------------------
    // Drawing
    // -------------------------------------------------------------------------
    /**
     * Draw the top card from the specified deck.
     * If the draw pile is empty, reshuffles the discard pile to replenish it.
     *
     * @returns [CardConfig, newCardDeckState, nextRNGState]
     * @throws Error if no cards are defined in MapConfig for this deck type.
     */
    draw(deckType, state, mapConfig) {
        const decks = state.cardDecks;
        let rngState = state.rngState;
        // Select the correct pile
        const drawPile = deckType === shared_1.CardDeckType.CHANCE
            ? [...decks.chance]
            : [...decks.communityChest];
        const discardPile = deckType === shared_1.CardDeckType.CHANCE
            ? [...decks.chanceDiscard]
            : [...decks.communityChestDiscard];
        // Reshuffle if draw pile is empty
        if (drawPile.length === 0) {
            const [reshuffled, nextRng] = DiceEngine_js_1.DiceEngine.shuffle(discardPile, rngState);
            rngState = nextRng;
            drawPile.push(...reshuffled);
            discardPile.length = 0;
        }
        const cardId = drawPile.shift();
        if (!cardId) {
            throw new Error(`[CARD_ENGINE] No cards available in ${deckType} deck.`);
        }
        const cardConfig = this.findCard(cardId, deckType, mapConfig);
        discardPile.push(cardId);
        const newDecks = deckType === shared_1.CardDeckType.CHANCE
            ? { ...decks, chance: drawPile, chanceDiscard: discardPile }
            : { ...decks, communityChest: drawPile, communityChestDiscard: discardPile };
        return [cardConfig, newDecks, rngState];
    }
    /**
     * Remove a Get Out Of Jail Free card from the discard pile
     * when a player uses one (returned to discard, not given back to deck).
     *
     * TODO: Implement — find and remove the GOOJF card from wherever it is.
     * GOOJF cards can be held by players; this handles the return-on-use.
     */
    returnJailCard(deckType, state) {
        // TODO: Implement
        throw new errors_js_1.EngineNotImplementedError('CardEngine.returnJailCard');
    }
    // -------------------------------------------------------------------------
    // Effect Application
    // -------------------------------------------------------------------------
    /**
     * Apply a card's effect to the game state.
     * Dispatches based on CardConfig.effect.type.
     *
     * Each effect type has its own handler. All return EngineResult.
     *
     * @param state - Current state (AFTER card has been drawn from deck).
     * @param cardConfig - The drawn card's configuration.
     * @param playerId - Player who drew the card.
     * @param mapConfig - Map configuration.
     */
    applyEffect(state, cardConfig, playerId, mapConfig) {
        const { effect } = cardConfig;
        switch (effect.type) {
            case shared_1.CardEffectType.COLLECT_FROM_BANK:
                return this.applyCollectFromBank(state, cardConfig, playerId, mapConfig);
            case shared_1.CardEffectType.PAY_TO_BANK:
                return this.applyPayToBank(state, cardConfig, playerId, mapConfig);
            case shared_1.CardEffectType.COLLECT_FROM_PLAYERS:
                return this.applyCollectFromPlayers(state, cardConfig, playerId, mapConfig);
            case shared_1.CardEffectType.PAY_TO_PLAYERS:
                return this.applyPayToPlayers(state, cardConfig, playerId, mapConfig);
            case shared_1.CardEffectType.MOVE_TO_TILE:
                return this.applyMoveToTile(state, cardConfig, playerId, mapConfig);
            case shared_1.CardEffectType.MOVE_FORWARD:
                return this.applyMoveForward(state, cardConfig, playerId, mapConfig);
            case shared_1.CardEffectType.MOVE_BACKWARD:
                return this.applyMoveBackward(state, cardConfig, playerId, mapConfig);
            case shared_1.CardEffectType.MOVE_TO_NEAREST:
                return this.applyMoveToNearest(state, cardConfig, playerId, mapConfig);
            case shared_1.CardEffectType.GO_TO_JAIL:
                return this.applyGoToJail(state, cardConfig, playerId, mapConfig);
            case shared_1.CardEffectType.GET_OUT_OF_JAIL_FREE:
                return this.applyGetOutOfJailFree(state, cardConfig, playerId, mapConfig);
            case shared_1.CardEffectType.REPAIRS:
                return this.applyRepairs(state, cardConfig, playerId, mapConfig);
            case shared_1.CardEffectType.CUSTOM:
                return this.applyCustomEffect(state, cardConfig, playerId, mapConfig);
            default: {
                const _exhaustive = effect.type;
                throw new Error(`[CARD_ENGINE] Unknown card effect type: ${String(_exhaustive)}`);
            }
        }
    }
    // -------------------------------------------------------------------------
    // Effect Handler Stubs
    // -------------------------------------------------------------------------
    /** TODO: Player receives amount from bank. */
    applyCollectFromBank(state, card, playerId, config) {
        throw new errors_js_1.EngineNotImplementedError('CardEngine.applyCollectFromBank');
    }
    /** TODO: Player pays amount to bank. Trigger bankruptcy if insufficient. */
    applyPayToBank(state, card, playerId, config) {
        throw new errors_js_1.EngineNotImplementedError('CardEngine.applyPayToBank');
    }
    /** TODO: Player collects amount from every other player. */
    applyCollectFromPlayers(state, card, playerId, config) {
        throw new errors_js_1.EngineNotImplementedError('CardEngine.applyCollectFromPlayers');
    }
    /** TODO: Player pays amount to every other player. */
    applyPayToPlayers(state, card, playerId, config) {
        throw new errors_js_1.EngineNotImplementedError('CardEngine.applyPayToPlayers');
    }
    /** TODO: Move player directly to a specific tile ID. Award GO reward if passed. */
    applyMoveToTile(state, card, playerId, config) {
        throw new errors_js_1.EngineNotImplementedError('CardEngine.applyMoveToTile');
    }
    /** TODO: Advance player N steps forward. Award GO reward if passed. */
    applyMoveForward(state, card, playerId, config) {
        throw new errors_js_1.EngineNotImplementedError('CardEngine.applyMoveForward');
    }
    /** TODO: Move player N steps backward. Do NOT award GO reward. */
    applyMoveBackward(state, card, playerId, config) {
        throw new errors_js_1.EngineNotImplementedError('CardEngine.applyMoveBackward');
    }
    /** TODO: Advance player to nearest RAILROAD or UTILITY. Award GO reward if passed. */
    applyMoveToNearest(state, card, playerId, config) {
        throw new errors_js_1.EngineNotImplementedError('CardEngine.applyMoveToNearest');
    }
    /** TODO: Send player directly to jail. No doubles needed. */
    applyGoToJail(state, card, playerId, config) {
        throw new errors_js_1.EngineNotImplementedError('CardEngine.applyGoToJail');
    }
    /** TODO: Add 1 Get Out Of Jail Free card to player's hand. */
    applyGetOutOfJailFree(state, card, playerId, config) {
        throw new errors_js_1.EngineNotImplementedError('CardEngine.applyGetOutOfJailFree');
    }
    /** TODO: Charge player repair costs per house and hotel across all owned properties. */
    applyRepairs(state, card, playerId, config) {
        throw new errors_js_1.EngineNotImplementedError('CardEngine.applyRepairs');
    }
    /** TODO: Dispatch to custom handler from CardHandlerRegistry. */
    applyCustomEffect(state, card, playerId, config) {
        const handlerId = card.effect.customHandler;
        if (!handlerId) {
            throw new Error(`[CARD_ENGINE] Card '${card.id}' has CUSTOM effect type but no customHandler ID.`);
        }
        const handler = this.handlerRegistry.get(handlerId);
        if (!handler) {
            throw new Error(`[CARD_ENGINE] No handler registered for customHandler '${handlerId}'.`);
        }
        return handler.handle(state, playerId, card.id, config);
    }
    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------
    findCard(cardId, deckType, mapConfig) {
        const deck = deckType === shared_1.CardDeckType.CHANCE
            ? mapConfig.cards.chance
            : mapConfig.cards.communityChest;
        const card = deck.find(c => c.id === cardId);
        if (!card) {
            throw new Error(`[CARD_ENGINE] Card '${cardId}' not found in ${deckType} deck config.`);
        }
        return card;
    }
}
exports.CardEngine = CardEngine;
//# sourceMappingURL=CardEngine.js.map