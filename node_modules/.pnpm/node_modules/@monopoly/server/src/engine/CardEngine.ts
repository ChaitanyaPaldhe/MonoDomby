// =============================================================================
// engine/CardEngine.ts
// Chance and Community Chest card subsystem.
// =============================================================================

import { CardDeckType, CardEffectType, EventType } from '@monopoly/shared';
import type {
  GameState,
  PlayerId,
  RNGState,
  CardDeckState,
  MapConfig,
  CardConfig,
  ClientAction,
  CardAppliedEvent
} from '@monopoly/shared';
import type { EngineResult } from './types.js';
import { DiceEngine } from './DiceEngine.js';
import { EngineStateCorruptionError, EngineNotImplementedError } from './errors.js';
import { CardEffectRegistry } from './CardEffectRegistry.js';
import * as Handlers from './CardHandlers.js';
import { createHash } from 'node:crypto';
import type { TileResolver } from './TileResolver.js';

// ---------------------------------------------------------------------------
// CardEngine
// ---------------------------------------------------------------------------

export class CardEngine {
  private readonly registry: CardEffectRegistry;

  constructor(customRegistry?: CardEffectRegistry) {
    if (customRegistry) {
      this.registry = customRegistry;
    } else {
      this.registry = new CardEffectRegistry();
      this.registerDefaultHandlers();
    }
  }

  private registerDefaultHandlers() {
    this.registry.register(CardEffectType.COLLECT_FROM_BANK, Handlers.applyCollectFromBank);
    this.registry.register(CardEffectType.PAY_TO_BANK, Handlers.applyPayToBank);
    this.registry.register(CardEffectType.COLLECT_FROM_PLAYERS, Handlers.applyCollectFromPlayers);
    this.registry.register(CardEffectType.PAY_TO_PLAYERS, Handlers.applyPayToPlayers);
    this.registry.register(CardEffectType.MOVE_TO_TILE, Handlers.applyMoveToTile);
    this.registry.register(CardEffectType.MOVE_FORWARD, Handlers.applyMoveForward);
    this.registry.register(CardEffectType.MOVE_BACKWARD, Handlers.applyMoveBackward);
    this.registry.register(CardEffectType.MOVE_TO_NEAREST, Handlers.applyMoveToNearest);
    this.registry.register(CardEffectType.GO_TO_JAIL, Handlers.applyGoToJail);
    this.registry.register(CardEffectType.GET_OUT_OF_JAIL_FREE, Handlers.applyGetOutOfJailFree);
    this.registry.register(CardEffectType.REPAIRS, Handlers.applyRepairs);
  }

  // -------------------------------------------------------------------------
  // Deck Initialisation
  // -------------------------------------------------------------------------

  buildInitialDecks(
    mapConfig: MapConfig,
    rngState: RNGState,
  ): [CardDeckState, RNGState] {
    const chanceIds = mapConfig.cards.chance.map(c => c.id);
    const communityIds = mapConfig.cards.communityChest.map(c => c.id);

    const [shuffledChance, rng1] = DiceEngine.shuffle(chanceIds, rngState);
    const [shuffledCommunity, rng2] = DiceEngine.shuffle(communityIds, rng1);

    const decks: CardDeckState = {
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
  executeCard(
    state: GameState,
    action: ClientAction,
    mapConfig: MapConfig,
    actingPlayerId: PlayerId,
    tileResolver: TileResolver
  ): EngineResult {
    const pendingCard = state.pendingCard;
    if (!pendingCard) {
      throw new EngineStateCorruptionError('CardEngine: No pending card found in GameState.');
    }

    if (pendingCard.playerId !== actingPlayerId) {
      throw new EngineStateCorruptionError('CardEngine: APPLY_CARD acting player does not match pending card player.');
    }

    const cardConfig = this.findCard(pendingCard.cardId, pendingCard.deckType, mapConfig);

    let executor = this.registry.get(cardConfig.effect.type);
    if (cardConfig.effect.type === CardEffectType.CUSTOM && cardConfig.effect.customHandler) {
      executor = this.registry.getCustom(cardConfig.effect.customHandler);
    }

    if (!executor) {
      throw new Error(`[CARD_ENGINE] No handler registered for effect type: ${cardConfig.effect.type}`);
    }

    // Call the effect handler
    const result = executor(state, cardConfig, actingPlayerId, mapConfig, action, tileResolver);

    // After effect application, we need to clear pendingCard.
    // Also, emit CARD_APPLIED event.
    const eventId = createHash('sha256').update(`${action.actionId}:card-applied`).digest('hex');
    const appliedEvent: CardAppliedEvent = {
      id: eventId,
      type: EventType.CARD_APPLIED,
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

  private findCard(cardId: string, deckType: CardDeckType, mapConfig: MapConfig): CardConfig {
    const deck = deckType === CardDeckType.CHANCE
      ? mapConfig.cards.chance
      : mapConfig.cards.communityChest;

    const card = deck.find(c => c.id === cardId);
    if (!card) {
      throw new Error(`[CARD_ENGINE] Card '${cardId}' not found in ${deckType} deck config.`);
    }
    return card;
  }
}
