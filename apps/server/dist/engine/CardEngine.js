"use strict";
// =============================================================================
// engine/CardEngine.ts
// Chance and Community Chest card subsystem.
// =============================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardEngine = void 0;
const shared_1 = require("@monopoly/shared");
const DiceEngine_js_1 = require("./DiceEngine.js");
const errors_js_1 = require("./errors.js");
const CardEffectRegistry_js_1 = require("./CardEffectRegistry.js");
const Handlers = __importStar(require("./CardHandlers.js"));
const node_crypto_1 = require("node:crypto");
// ---------------------------------------------------------------------------
// CardEngine
// ---------------------------------------------------------------------------
class CardEngine {
    registry;
    constructor(customRegistry) {
        if (customRegistry) {
            this.registry = customRegistry;
        }
        else {
            this.registry = new CardEffectRegistry_js_1.CardEffectRegistry();
            this.registerDefaultHandlers();
        }
    }
    registerDefaultHandlers() {
        this.registry.register(shared_1.CardEffectType.COLLECT_FROM_BANK, Handlers.applyCollectFromBank);
        this.registry.register(shared_1.CardEffectType.PAY_TO_BANK, Handlers.applyPayToBank);
        this.registry.register(shared_1.CardEffectType.COLLECT_FROM_PLAYERS, Handlers.applyCollectFromPlayers);
        this.registry.register(shared_1.CardEffectType.PAY_TO_PLAYERS, Handlers.applyPayToPlayers);
        this.registry.register(shared_1.CardEffectType.MOVE_TO_TILE, Handlers.applyMoveToTile);
        this.registry.register(shared_1.CardEffectType.MOVE_FORWARD, Handlers.applyMoveForward);
        this.registry.register(shared_1.CardEffectType.MOVE_BACKWARD, Handlers.applyMoveBackward);
        this.registry.register(shared_1.CardEffectType.MOVE_TO_NEAREST, Handlers.applyMoveToNearest);
        this.registry.register(shared_1.CardEffectType.GO_TO_JAIL, Handlers.applyGoToJail);
        this.registry.register(shared_1.CardEffectType.GET_OUT_OF_JAIL_FREE, Handlers.applyGetOutOfJailFree);
        this.registry.register(shared_1.CardEffectType.REPAIRS, Handlers.applyRepairs);
    }
    // -------------------------------------------------------------------------
    // Deck Initialisation
    // -------------------------------------------------------------------------
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
    // Execution
    // -------------------------------------------------------------------------
    /**
     * Executes the drawn card using the registry.
     * This is called when the player sends APPLY_CARD during the CARD_DRAWN phase.
     */
    executeCard(state, action, mapConfig, actingPlayerId, tileResolver) {
        const pendingCard = state.pendingCard;
        if (!pendingCard) {
            throw new errors_js_1.EngineStateCorruptionError('CardEngine: No pending card found in GameState.');
        }
        if (pendingCard.playerId !== actingPlayerId) {
            throw new errors_js_1.EngineStateCorruptionError('CardEngine: APPLY_CARD acting player does not match pending card player.');
        }
        const cardConfig = this.findCard(pendingCard.cardId, pendingCard.deckType, mapConfig);
        let executor = this.registry.get(cardConfig.effect.type);
        if (cardConfig.effect.type === shared_1.CardEffectType.CUSTOM && cardConfig.effect.customHandler) {
            executor = this.registry.getCustom(cardConfig.effect.customHandler);
        }
        if (!executor) {
            throw new Error(`[CARD_ENGINE] No handler registered for effect type: ${cardConfig.effect.type}`);
        }
        // Call the effect handler
        const result = executor(state, cardConfig, actingPlayerId, mapConfig, action, tileResolver);
        // After effect application, we need to clear pendingCard.
        // Also, emit CARD_APPLIED event.
        const eventId = (0, node_crypto_1.createHash)('sha256').update(`${action.actionId}:card-applied`).digest('hex');
        const appliedEvent = {
            id: eventId,
            type: shared_1.EventType.CARD_APPLIED,
            roomId: action.roomId,
            gameId: state.id,
            ts: action.clientTs,
            payload: {
                playerId: actingPlayerId,
                cardId: cardConfig.id,
                effectType: cardConfig.effect.type,
            },
            audience: { type: 'ALL' },
        };
        const finalState = {
            ...result.newState,
            pendingCard: null,
        };
        return {
            newState: finalState,
            events: [appliedEvent, ...result.events],
        };
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