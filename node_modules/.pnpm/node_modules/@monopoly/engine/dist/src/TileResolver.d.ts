import type { GameState, PlayerId } from '@monopoly/shared';
import type { MapConfig, Tile } from '@monopoly/maps';
import type { ClientAction } from '@monopoly/shared';
import type { EngineResult } from './types.js';
/**
 * Handler function for a tile with TileType.CUSTOM.
 * Registered by tile.id in TileResolver's constructor.
 *
 * @param state          Current game state (player already at tile position).
 * @param tile           The Tile definition from MapConfig.
 * @param config         Full MapConfig for this game.
 * @param action         The originating ROLL_DICE client action.
 * @param actingPlayerId The player who landed on this tile.
 * @returns EngineResult. Do NOT increment version inside a handler.
 */
export type CustomTileHandlerFn = (state: GameState, tile: Tile, config: MapConfig, action: ClientAction, actingPlayerId: PlayerId) => EngineResult;
/**
 * Determines the effects of a player landing on a board tile.
 *
 * Instantiate once per GameEngine (or per game session for custom handlers).
 * Inject into ActionProcessor so resolveLandingTile delegates here.
 *
 * ### Extensibility
 * To handle a CUSTOM tile without touching the engine core:
 * ```typescript
 * const resolver = new TileResolver(new Map([
 *   ['bonus-square', myBonusHandler],
 * ]));
 * ```
 */
export declare class TileResolver {
    /**
     * Registry of CUSTOM tile handlers, keyed by tile ID (not tile type).
     * Looked up in resolveCustom(); unregistered tiles fall back to POST_ROLL.
     */
    private readonly customHandlers;
    constructor(customHandlers?: ReadonlyMap<string, CustomTileHandlerFn>);
    /**
     * Resolve the effects of a player landing on a tile.
     *
     * Preconditions (enforced by ActionProcessor):
     *  - Player is already at `tileIndex` in `state.players[actingPlayerId].position`.
     *  - `state.turn.phase` is ROLLED.
     *
     * @param state          State after movement (player at new position, ROLLED phase).
     * @param tileIndex      Zero-based board index the player landed on.
     * @param config         Map configuration (tile definitions, rules, deck config).
     * @param action         The originating ROLL_DICE action (for event IDs and ts).
     * @param actingPlayerId JWT-verified acting player.
     * @returns EngineResult — new state (correct phase/pendingDecision) + events emitted.
     */
    resolve(state: GameState, tileIndex: number, config: MapConfig, action: ClientAction, actingPlayerId: PlayerId): EngineResult;
    private dispatchByType;
    /**
     * GO tile: no mandatory effect.
     * The GO salary was already credited during the movement phase
     * (ActionProcessor.handleRollDice awards it when passedGo is true, which
     * also covers landing exactly on GO).
     *
     * → POST_ROLL
     */
    private resolveGo;
    /**
     * Just Visiting / Jail corner: player arrived by normal movement, not imprisoned.
     * No mandatory effect.
     *
     * → POST_ROLL
     */
    private resolveJailVisit;
    /**
     * Free Parking tile: no mandatory effect in standard rules.
     *
     * If `config.rules.freeParkingMoney` is enabled and `state.bank.freeParkingPot > 0`,
     * the player would collect the pot. Pot transfer is a future TODO.
     *
     * → POST_ROLL
     *
     * TODO (bank transfer task):
     *   if config.rules.freeParkingMoney && state.bank.freeParkingPot > 0:
     *     player.money    += state.bank.freeParkingPot
     *     bank.freeParkingPot = 0
     *     emit MONEY_TRANSFERRED event
     */
    private resolveFreeParking;
    /**
     * Property tile resolution:
     *
     * │ ownerId === null            → PURCHASE_DECISION                      │
     * │ ownerId === actingPlayer    → POST_ROLL (own property, free landing)  │
     * │ isMortgaged === true        → POST_ROLL (no rent on mortgaged tile)   │
     * │ ownerId === another player  → POST_ROLL (rent stub — TODO)            │
     *
     * TODO (rent collection task):
     *   - Compute rent from propertyData.rents based on houses/hotel and monopoly bonus.
     *   - Debit actingPlayer.money, credit owner.money.
     *   - Emit RENT_PAID event.
     *   - Trigger bankruptcy check if actingPlayer cannot pay.
     */
    private resolveProperty;
    /**
     * Railroad tile resolution:
     *
     * │ ownerId === null            → PURCHASE_DECISION                  │
     * │ ownerId === actingPlayer    → POST_ROLL (own railroad, free)     │
     * │ isMortgaged === true        → POST_ROLL (no rent)                │
     * │ ownerId === another player  → POST_ROLL (rent stub — TODO)       │
     *
     * TODO (rent collection task):
     *   - Count railroads held by ownerId using state.players[ownerId].properties.
     *   - Rent = railroadData.rents[count - 1].
     *   - Emit RENT_PAID event.
     */
    private resolveRailroad;
    /**
     * Utility tile resolution:
     *
     * │ ownerId === null            → PURCHASE_DECISION                  │
     * │ ownerId === actingPlayer    → POST_ROLL (own utility, free)      │
     * │ isMortgaged === true        → POST_ROLL (no rent)                │
     * │ ownerId === another player  → POST_ROLL (rent stub — TODO)       │
     *
     * TODO (rent collection task):
     *   - Count utilities held by ownerId.
     *   - Rent = diceTotal × utilityData.diceMultipliers[count - 1].
     *   - Use state.turn.diceValues for the dice total.
     *   - Emit RENT_PAID event.
     */
    private resolveUtility;
    /**
     * Chance tile: draw the top card from the Chance deck.
     *
     * Operations (in order):
     *  1. Reshuffle chanceDiscard → chance if the draw pile is empty (uses PRNG).
     *  2. Draw pile[0] (shift it to chanceDiscard).
     *  3. Build new cardDecks state (immutable spread).
     *  4. Set pendingDecision = { CARD_EFFECT, cardId, CHANCE }.
     *  5. Emit CARD_DRAWN event.
     *  6. Transition to CARD_DRAWN phase.
     *
     * The card EFFECT is NOT applied here. Card effect execution belongs to
     * the future APPLY_CARD action (or an auto-resolution step).
     *
     * → CARD_DRAWN (with CARD_DRAWN event)
     */
    private resolveChance;
    /**
     * Community Chest tile: draw the top card from the Community Chest deck.
     * Identical flow to CHANCE but operates on the communityChest deck.
     *
     * → CARD_DRAWN (with CARD_DRAWN event)
     */
    private resolveCommunityChest;
    /**
     * Tax tile: player owes the configured tax amount (fixed or percentage).
     *
     * Configured via tile.taxData:
     *   isPercentage = false → tax = taxData.amount
     *   isPercentage = true  → tax = player.netWorth × taxData.percentage
     *   destination = BANK         → money → bank.money
     *   destination = FREE_PARKING → money → bank.freeParkingPot
     *
     * → POST_ROLL (stub — tax collection implemented in a future task)
     *
     * TODO (bank transfer task):
     *   1. Compute taxDue per above rules.
     *   2. Debit actingPlayer.money.
     *   3. Credit bank.money or bank.freeParkingPot per taxData.destination.
     *   4. Emit TAX_PAID event.
     *   5. Trigger bankruptcy check if actingPlayer cannot pay.
     */
    private resolveTax;
    /**
     * Go To Jail tile: player is immediately sent to jail.
     *
     * Effects applied in this order:
     *  1. player.position  ← config.board.jailTileIndex  (teleport, no GO salary)
     *  2. player.jailState ← { reason: GO_TO_JAIL_TILE, turnsServed: 0, jailedAt }
     *  3. turn.phase       ← POST_ROLL  (turn ends, JAIL_DECISION on next turn)
     *  4. Emit PLAYER_JAILED event.
     *
     * Note on event sequencing:
     *   handleRollDice already emitted PLAYER_MOVED (player→GO_TO_JAIL tile).
     *   This method emits PLAYER_JAILED. The client interprets that event as
     *   "teleport this player to the jail corner". No second PLAYER_MOVED needed.
     *
     * → POST_ROLL (with PLAYER_JAILED event)
     */
    private resolveGoToJail;
    /**
     * Custom tile: delegate to the registered handler for this tile ID.
     *
     * Lookup key = tile.id. This allows multiple CUSTOM tiles on the same board,
     * each with their own handler, without requiring new TileType enum values.
     *
     * If no handler is registered, falls back to POST_ROLL (safe no-op).
     * This prevents an unregistered custom tile from crashing a live game.
     *
     * → handler result | POST_ROLL (fallback)
     */
    private resolveCustom;
    /**
     * Draw the top card from a deck, update CardDeckState immutably, and
     * transition to CARD_DRAWN phase with the correct pendingDecision.
     *
     * Handles automatic reshuffle (via DiceEngine.shuffle) when the draw pile
     * is empty. Reshuffle advances rngState deterministically.
     */
    private drawCardAndTransition;
    /** Transition to PURCHASE_DECISION with a PURCHASE pending decision. */
    private toPurchaseDecision;
    /** Transition to POST_ROLL, clearing any pending decision. */
    private toPostRoll;
    private static buildCardDrawnEvent;
    private static buildPlayerJailedEvent;
}
//# sourceMappingURL=TileResolver.d.ts.map