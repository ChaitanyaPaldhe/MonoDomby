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

import { CardDeckType } from '@monopoly/shared';
import type { GameState, PlayerId, RNGState, CardDeckState } from '@monopoly/shared';
import type { MapConfig, CardConfig } from '@monopoly/shared';
import type { EngineResult, CardHandler } from './types.js';
import { DiceEngine } from './DiceEngine.js';
import { EngineNotImplementedError } from './errors.js';

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
export class CardHandlerRegistry {
  private readonly handlers = new Map<string, CardHandler>();

  register(handler: CardHandler): this {
    this.handlers.set(handler.id, handler);
    return this;
  }

  get(id: string): CardHandler | undefined {
    return this.handlers.get(id);
  }

  has(id: string): boolean {
    return this.handlers.has(id);
  }
}

// ---------------------------------------------------------------------------
// CardEngine
// ---------------------------------------------------------------------------

/**
 * Manages Chance and Community Chest card decks.
 *
 * All operations return new GameState — no mutation.
 */
export class CardEngine {
  private readonly handlerRegistry: CardHandlerRegistry;

  constructor(handlerRegistry: CardHandlerRegistry = new CardHandlerRegistry()) {
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
  // Drawing
  // -------------------------------------------------------------------------

  /**
   * Draw the top card from the specified deck.
   * If the draw pile is empty, reshuffles the discard pile to replenish it.
   *
   * @returns [CardConfig, newCardDeckState, nextRNGState]
   * @throws Error if no cards are defined in MapConfig for this deck type.
   */
  draw(
    deckType: CardDeckType,
    state: GameState,
    mapConfig: MapConfig,
  ): [CardConfig, CardDeckState, RNGState] {
    const decks = state.cardDecks;
    let rngState = state.rngState;

    // Select the correct pile
    const drawPile = deckType === CardDeckType.CHANCE
      ? [...decks.chance]
      : [...decks.communityChest];
    const discardPile = deckType === CardDeckType.CHANCE
      ? [...decks.chanceDiscard]
      : [...decks.communityChestDiscard];

    // Reshuffle if draw pile is empty
    if (drawPile.length === 0) {
      const [reshuffled, nextRng] = DiceEngine.shuffle(discardPile, rngState);
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

    const newDecks: CardDeckState = deckType === CardDeckType.CHANCE
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
  returnJailCard(deckType: CardDeckType, state: GameState): GameState {
    // TODO: Implement
    throw new EngineNotImplementedError('CardEngine.returnJailCard');
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
  applyEffect(
    state: GameState,
    cardConfig: CardConfig,
    playerId: PlayerId,
    mapConfig: MapConfig,
  ): EngineResult {
    const { effect } = cardConfig;

    switch (effect.type) {
      case 'COLLECT_FROM_BANK':
        return this.applyCollectFromBank(state, cardConfig, playerId, mapConfig);
      case 'PAY_TO_BANK':
        return this.applyPayToBank(state, cardConfig, playerId, mapConfig);
      case 'COLLECT_FROM_PLAYERS':
        return this.applyCollectFromPlayers(state, cardConfig, playerId, mapConfig);
      case 'PAY_TO_PLAYERS':
        return this.applyPayToPlayers(state, cardConfig, playerId, mapConfig);
      case 'MOVE_TO_TILE':
        return this.applyMoveToTile(state, cardConfig, playerId, mapConfig);
      case 'MOVE_FORWARD':
        return this.applyMoveForward(state, cardConfig, playerId, mapConfig);
      case 'MOVE_BACKWARD':
        return this.applyMoveBackward(state, cardConfig, playerId, mapConfig);
      case 'MOVE_TO_NEAREST':
        return this.applyMoveToNearest(state, cardConfig, playerId, mapConfig);
      case 'GO_TO_JAIL':
        return this.applyGoToJail(state, cardConfig, playerId, mapConfig);
      case 'GET_OUT_OF_JAIL_FREE':
        return this.applyGetOutOfJailFree(state, cardConfig, playerId, mapConfig);
      case 'REPAIRS':
        return this.applyRepairs(state, cardConfig, playerId, mapConfig);
      case 'CUSTOM':
        return this.applyCustomEffect(state, cardConfig, playerId, mapConfig);
      default: {
        const _exhaustive: never = effect.type;
        throw new Error(`[CARD_ENGINE] Unknown card effect type: ${String(_exhaustive)}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Effect Handler Stubs
  // -------------------------------------------------------------------------

  /** TODO: Player receives amount from bank. */
  private applyCollectFromBank(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig): EngineResult {
    throw new EngineNotImplementedError('CardEngine.applyCollectFromBank');
  }

  /** TODO: Player pays amount to bank. Trigger bankruptcy if insufficient. */
  private applyPayToBank(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig): EngineResult {
    throw new EngineNotImplementedError('CardEngine.applyPayToBank');
  }

  /** TODO: Player collects amount from every other player. */
  private applyCollectFromPlayers(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig): EngineResult {
    throw new EngineNotImplementedError('CardEngine.applyCollectFromPlayers');
  }

  /** TODO: Player pays amount to every other player. */
  private applyPayToPlayers(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig): EngineResult {
    throw new EngineNotImplementedError('CardEngine.applyPayToPlayers');
  }

  /** TODO: Move player directly to a specific tile ID. Award GO reward if passed. */
  private applyMoveToTile(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig): EngineResult {
    throw new EngineNotImplementedError('CardEngine.applyMoveToTile');
  }

  /** TODO: Advance player N steps forward. Award GO reward if passed. */
  private applyMoveForward(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig): EngineResult {
    throw new EngineNotImplementedError('CardEngine.applyMoveForward');
  }

  /** TODO: Move player N steps backward. Do NOT award GO reward. */
  private applyMoveBackward(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig): EngineResult {
    throw new EngineNotImplementedError('CardEngine.applyMoveBackward');
  }

  /** TODO: Advance player to nearest RAILROAD or UTILITY. Award GO reward if passed. */
  private applyMoveToNearest(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig): EngineResult {
    throw new EngineNotImplementedError('CardEngine.applyMoveToNearest');
  }

  /** TODO: Send player directly to jail. No doubles needed. */
  private applyGoToJail(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig): EngineResult {
    throw new EngineNotImplementedError('CardEngine.applyGoToJail');
  }

  /** TODO: Add 1 Get Out Of Jail Free card to player's hand. */
  private applyGetOutOfJailFree(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig): EngineResult {
    throw new EngineNotImplementedError('CardEngine.applyGetOutOfJailFree');
  }

  /** TODO: Charge player repair costs per house and hotel across all owned properties. */
  private applyRepairs(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig): EngineResult {
    throw new EngineNotImplementedError('CardEngine.applyRepairs');
  }

  /** TODO: Dispatch to custom handler from CardHandlerRegistry. */
  private applyCustomEffect(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig): EngineResult {
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
