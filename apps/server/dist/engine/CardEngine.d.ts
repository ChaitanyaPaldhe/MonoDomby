import { CardDeckType } from '@monopoly/shared';
import type { GameState, PlayerId, RNGState, CardDeckState } from '@monopoly/shared';
import type { MapConfig, CardConfig } from '@monopoly/shared';
import type { EngineResult, CardHandler } from './types.js';
/**
 * Registry for custom card handlers (CardEffectType.CUSTOM).
 * Maps customHandler ID → handler function.
 *
 * Built-in card effects (COLLECT_FROM_BANK, MOVE_TO_TILE, etc.)
 * are handled inline by CardEngine.applyEffect — they are NOT in this registry.
 */
export declare class CardHandlerRegistry {
    private readonly handlers;
    register(handler: CardHandler): this;
    get(id: string): CardHandler | undefined;
    has(id: string): boolean;
}
/**
 * Manages Chance and Community Chest card decks.
 *
 * All operations return new GameState — no mutation.
 */
export declare class CardEngine {
    private readonly handlerRegistry;
    constructor(handlerRegistry?: CardHandlerRegistry);
    /**
     * Build initial shuffled CardDeckState from MapConfig.
     * Called once at game start.
     *
     * @param mapConfig - Map configuration containing card definitions.
     * @param rngState - Initial RNG state (will be advanced by shuffle).
     * @returns [CardDeckState, nextRNGState]
     */
    buildInitialDecks(mapConfig: MapConfig, rngState: RNGState): [CardDeckState, RNGState];
    /**
     * Draw the top card from the specified deck.
     * If the draw pile is empty, reshuffles the discard pile to replenish it.
     *
     * @returns [CardConfig, newCardDeckState, nextRNGState]
     * @throws Error if no cards are defined in MapConfig for this deck type.
     */
    draw(deckType: CardDeckType, state: GameState, mapConfig: MapConfig): [CardConfig, CardDeckState, RNGState];
    /**
     * Remove a Get Out Of Jail Free card from the discard pile
     * when a player uses one (returned to discard, not given back to deck).
     *
     * TODO: Implement — find and remove the GOOJF card from wherever it is.
     * GOOJF cards can be held by players; this handles the return-on-use.
     */
    returnJailCard(deckType: CardDeckType, state: GameState): GameState;
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
    applyEffect(state: GameState, cardConfig: CardConfig, playerId: PlayerId, mapConfig: MapConfig): EngineResult;
    /** TODO: Player receives amount from bank. */
    private applyCollectFromBank;
    /** TODO: Player pays amount to bank. Trigger bankruptcy if insufficient. */
    private applyPayToBank;
    /** TODO: Player collects amount from every other player. */
    private applyCollectFromPlayers;
    /** TODO: Player pays amount to every other player. */
    private applyPayToPlayers;
    /** TODO: Move player directly to a specific tile ID. Award GO reward if passed. */
    private applyMoveToTile;
    /** TODO: Advance player N steps forward. Award GO reward if passed. */
    private applyMoveForward;
    /** TODO: Move player N steps backward. Do NOT award GO reward. */
    private applyMoveBackward;
    /** TODO: Advance player to nearest RAILROAD or UTILITY. Award GO reward if passed. */
    private applyMoveToNearest;
    /** TODO: Send player directly to jail. No doubles needed. */
    private applyGoToJail;
    /** TODO: Add 1 Get Out Of Jail Free card to player's hand. */
    private applyGetOutOfJailFree;
    /** TODO: Charge player repair costs per house and hotel across all owned properties. */
    private applyRepairs;
    /** TODO: Dispatch to custom handler from CardHandlerRegistry. */
    private applyCustomEffect;
    private findCard;
}
//# sourceMappingURL=CardEngine.d.ts.map