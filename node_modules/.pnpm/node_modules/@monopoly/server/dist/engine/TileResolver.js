"use strict";
// =============================================================================
// engine/TileResolver.ts
// Tile landing resolution engine.
//
// Design:
//  - Called by ActionProcessor after every player movement.
//  - Entirely data-driven from MapConfig; no hardcoded board indices or names.
//  - Dispatches on TileType from MapConfig, never on positional assumptions.
//  - Extensible: custom tile handlers are registered by tile ID in the
//    constructor — adding new CUSTOM tiles never requires engine changes.
//  - Pure function: no I/O, no side effects, no mutations.
//  - Version NOT incremented here; ActionProcessor handles that once per action.
//
// Outcomes per tile type:
//   GO              → POST_ROLL (GO salary already awarded in movement phase)
//   JAIL_VISIT      → POST_ROLL (just visiting, no mandatory effect)
//   FREE_PARKING    → POST_ROLL (or pot collection stub if house rule enabled)
//   PROPERTY        → PURCHASE_DECISION (unowned) | POST_ROLL (owned / mortgaged)
//   RAILROAD        → PURCHASE_DECISION (unowned) | POST_ROLL (owned / mortgaged)
//   UTILITY         → PURCHASE_DECISION (unowned) | POST_ROLL (owned / mortgaged)
//   CHANCE          → CARD_DRAWN + CARD_DRAWN event (deck state advanced)
//   COMMUNITY_CHEST → CARD_DRAWN + CARD_DRAWN event (deck state advanced)
//   TAX             → POST_ROLL (tax collection stub)
//   GO_TO_JAIL      → POST_ROLL + player teleported to jail + PLAYER_JAILED event
//   CUSTOM          → registered handler | POST_ROLL fallback
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.TileResolver = void 0;
const shared_1 = require("@monopoly/shared");
const errors_js_1 = require("./errors.js");
const DiceEngine_js_1 = require("./DiceEngine.js");
// ---------------------------------------------------------------------------
// TileResolver
// ---------------------------------------------------------------------------
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
class TileResolver {
    /**
     * Registry of CUSTOM tile handlers, keyed by tile ID (not tile type).
     * Looked up in resolveCustom(); unregistered tiles fall back to POST_ROLL.
     */
    customHandlers;
    constructor(customHandlers) {
        this.customHandlers = customHandlers ?? new Map();
    }
    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------
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
    resolve(state, tileIndex, config, action, actingPlayerId) {
        // MapConfig tiles MUST be ordered (tile.index === array index).
        // Fast-path first; linear search as a safety fallback.
        const fastLookup = config.board.tiles[tileIndex];
        const tile = fastLookup?.index === tileIndex
            ? fastLookup
            : config.board.tiles.find(t => t.index === tileIndex);
        if (!tile) {
            throw new errors_js_1.EngineStateCorruptionError(`TileResolver: No tile at index ${tileIndex} in MapConfig '${config.meta.id}'.`);
        }
        return this.dispatchByType(state, tile, config, action, actingPlayerId);
    }
    // -------------------------------------------------------------------------
    // Dispatch
    // -------------------------------------------------------------------------
    dispatchByType(state, tile, config, action, actingPlayerId) {
        switch (tile.type) {
            case shared_1.TileType.GO:
                return this.resolveGo(state);
            case shared_1.TileType.JAIL_VISIT:
                return this.resolveJailVisit(state);
            case shared_1.TileType.FREE_PARKING:
                return this.resolveFreeParking(state, config);
            case shared_1.TileType.PROPERTY:
                return this.resolveProperty(state, tile, actingPlayerId);
            case shared_1.TileType.RAILROAD:
                return this.resolveRailroad(state, tile, actingPlayerId);
            case shared_1.TileType.UTILITY:
                return this.resolveUtility(state, tile, actingPlayerId);
            case shared_1.TileType.CHANCE:
                return this.resolveChance(state, config, action, actingPlayerId);
            case shared_1.TileType.COMMUNITY_CHEST:
                return this.resolveCommunityChest(state, config, action, actingPlayerId);
            case shared_1.TileType.TAX:
                return this.resolveTax(state, tile);
            case shared_1.TileType.GO_TO_JAIL:
                return this.resolveGoToJail(state, config, action, actingPlayerId);
            case shared_1.TileType.CUSTOM:
                return this.resolveCustom(state, tile, config, action, actingPlayerId);
            default: {
                // TypeScript exhaustive check — fails at compile time when a new
                // TileType is added without a corresponding case.
                const _exhaustive = tile.type;
                throw new errors_js_1.EngineStateCorruptionError(`TileResolver: Unknown tile type '${String(_exhaustive)}' on tile '${tile.id}'.`);
            }
        }
    }
    // =========================================================================
    //  TileType.GO
    // =========================================================================
    /**
     * GO tile: no mandatory effect.
     * The GO salary was already credited during the movement phase
     * (ActionProcessor.handleRollDice awards it when passedGo is true, which
     * also covers landing exactly on GO).
     *
     * → POST_ROLL
     */
    resolveGo(state) {
        return { newState: this.toPostRoll(state), events: [] };
    }
    // =========================================================================
    //  TileType.JAIL_VISIT
    // =========================================================================
    /**
     * Just Visiting / Jail corner: player arrived by normal movement, not imprisoned.
     * No mandatory effect.
     *
     * → POST_ROLL
     */
    resolveJailVisit(state) {
        return { newState: this.toPostRoll(state), events: [] };
    }
    // =========================================================================
    //  TileType.FREE_PARKING
    // =========================================================================
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
    resolveFreeParking(state, _config) {
        return { newState: this.toPostRoll(state), events: [] };
    }
    // =========================================================================
    //  TileType.PROPERTY
    // =========================================================================
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
    resolveProperty(state, tile, actingPlayerId) {
        const tileId = tile.id;
        const tileState = state.board.tiles[tileId];
        if (!tileState) {
            throw new errors_js_1.EngineStateCorruptionError(`TileResolver: Missing BoardState for property tile '${tile.id}'.`);
        }
        // Unowned → offer purchase
        if (tileState.ownerId === null) {
            return this.toPurchaseDecision(state, tileId);
        }
        // Own property or mortgaged → free landing
        if (tileState.ownerId === actingPlayerId || tileState.isMortgaged) {
            return { newState: this.toPostRoll(state), events: [] };
        }
        // Another player owns it (unmortgaged) → rent due
        // TODO: implement rent calculation
        return { newState: this.toPostRoll(state), events: [] };
    }
    // =========================================================================
    //  TileType.RAILROAD
    // =========================================================================
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
    resolveRailroad(state, tile, actingPlayerId) {
        const tileId = tile.id;
        const tileState = state.board.tiles[tileId];
        if (!tileState) {
            throw new errors_js_1.EngineStateCorruptionError(`TileResolver: Missing BoardState for railroad tile '${tile.id}'.`);
        }
        if (tileState.ownerId === null) {
            return this.toPurchaseDecision(state, tileId);
        }
        if (tileState.ownerId === actingPlayerId || tileState.isMortgaged) {
            return { newState: this.toPostRoll(state), events: [] };
        }
        // Another player's railroad → rent due
        // TODO: implement railroad rent
        return { newState: this.toPostRoll(state), events: [] };
    }
    // =========================================================================
    //  TileType.UTILITY
    // =========================================================================
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
    resolveUtility(state, tile, actingPlayerId) {
        const tileId = tile.id;
        const tileState = state.board.tiles[tileId];
        if (!tileState) {
            throw new errors_js_1.EngineStateCorruptionError(`TileResolver: Missing BoardState for utility tile '${tile.id}'.`);
        }
        if (tileState.ownerId === null) {
            return this.toPurchaseDecision(state, tileId);
        }
        if (tileState.ownerId === actingPlayerId || tileState.isMortgaged) {
            return { newState: this.toPostRoll(state), events: [] };
        }
        // Another player's utility → rent due
        // TODO: implement utility rent
        return { newState: this.toPostRoll(state), events: [] };
    }
    // =========================================================================
    //  TileType.CHANCE
    // =========================================================================
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
    resolveChance(state, config, action, actingPlayerId) {
        return this.drawCardAndTransition(state, shared_1.CardDeckType.CHANCE, config, action, actingPlayerId);
    }
    // =========================================================================
    //  TileType.COMMUNITY_CHEST
    // =========================================================================
    /**
     * Community Chest tile: draw the top card from the Community Chest deck.
     * Identical flow to CHANCE but operates on the communityChest deck.
     *
     * → CARD_DRAWN (with CARD_DRAWN event)
     */
    resolveCommunityChest(state, config, action, actingPlayerId) {
        return this.drawCardAndTransition(state, shared_1.CardDeckType.COMMUNITY_CHEST, config, action, actingPlayerId);
    }
    // =========================================================================
    //  TileType.TAX
    // =========================================================================
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
    resolveTax(state, _tile) {
        return { newState: this.toPostRoll(state), events: [] };
    }
    // =========================================================================
    //  TileType.GO_TO_JAIL
    // =========================================================================
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
    resolveGoToJail(state, config, action, actingPlayerId) {
        const player = state.players[actingPlayerId];
        if (!player) {
            throw new errors_js_1.EngineStateCorruptionError(`TileResolver.resolveGoToJail: player '${actingPlayerId}' not in state.`);
        }
        const newJailState = {
            reason: shared_1.JailReason.GO_TO_JAIL_TILE,
            turnsServed: 0,
            jailedAt: action.clientTs,
        };
        const newState = {
            ...state,
            players: {
                ...state.players,
                [actingPlayerId]: {
                    ...player,
                    position: config.board.jailTileIndex,
                    jailState: newJailState,
                },
            },
            turn: {
                ...state.turn,
                phase: shared_1.TurnPhase.POST_ROLL,
                pendingDecision: null,
            },
        };
        return {
            newState,
            events: [
                TileResolver.buildPlayerJailedEvent(state, action, actingPlayerId, shared_1.JailReason.GO_TO_JAIL_TILE),
            ],
        };
    }
    // =========================================================================
    //  TileType.CUSTOM
    // =========================================================================
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
    resolveCustom(state, tile, config, action, actingPlayerId) {
        const handler = this.customHandlers.get(tile.id);
        if (handler) {
            return handler(state, tile, config, action, actingPlayerId);
        }
        // Safe no-op fallback: no handler registered for this tile ID
        return { newState: this.toPostRoll(state), events: [] };
    }
    // =========================================================================
    //  Private Helpers
    // =========================================================================
    /**
     * Draw the top card from a deck, update CardDeckState immutably, and
     * transition to CARD_DRAWN phase with the correct pendingDecision.
     *
     * Handles automatic reshuffle (via DiceEngine.shuffle) when the draw pile
     * is empty. Reshuffle advances rngState deterministically.
     */
    drawCardAndTransition(state, deckType, config, action, actingPlayerId) {
        const isChance = deckType === shared_1.CardDeckType.CHANCE;
        // Work on mutable copies for the draw/reshuffle logic
        const pile = isChance
            ? [...state.cardDecks.chance]
            : [...state.cardDecks.communityChest];
        const discard = isChance
            ? [...state.cardDecks.chanceDiscard]
            : [...state.cardDecks.communityChestDiscard];
        let rngState = state.rngState;
        // Reshuffle discard back into draw pile when exhausted
        if (pile.length === 0) {
            if (discard.length === 0) {
                throw new errors_js_1.EngineStateCorruptionError(`TileResolver: ${deckType} deck has zero cards in both pile and discard.`);
            }
            const [reshuffled, nextRng] = DiceEngine_js_1.DiceEngine.shuffle(discard, rngState);
            pile.push(...reshuffled);
            discard.length = 0;
            rngState = nextRng;
        }
        // Draw the top card
        const cardId = pile.shift();
        discard.push(cardId);
        // Look up card text from MapConfig for the event payload
        const cardPool = isChance ? config.cards.chance : config.cards.communityChest;
        const cardConfig = cardPool.find(c => c.id === cardId);
        const cardText = cardConfig?.text ?? '';
        // Build new immutable deck state
        const newDecks = isChance
            ? { ...state.cardDecks, chance: pile, chanceDiscard: discard }
            : { ...state.cardDecks, communityChest: pile, communityChestDiscard: discard };
        const pendingDecision = {
            type: shared_1.DecisionType.CARD_EFFECT,
            cardId,
            deckType,
        };
        const newState = {
            ...state,
            rngState,
            cardDecks: newDecks,
            turn: {
                ...state.turn,
                phase: shared_1.TurnPhase.CARD_DRAWN,
                pendingDecision,
            },
        };
        return {
            newState,
            events: [
                TileResolver.buildCardDrawnEvent(state, action, actingPlayerId, cardId, cardText, deckType),
            ],
        };
    }
    /** Transition to PURCHASE_DECISION with a PURCHASE pending decision. */
    toPurchaseDecision(state, tileId) {
        const pendingDecision = {
            type: shared_1.DecisionType.PURCHASE,
            tileId,
        };
        return {
            newState: {
                ...state,
                turn: {
                    ...state.turn,
                    phase: shared_1.TurnPhase.PURCHASE_DECISION,
                    pendingDecision,
                },
            },
            events: [],
        };
    }
    /** Transition to POST_ROLL, clearing any pending decision. */
    toPostRoll(state) {
        return {
            ...state,
            turn: {
                ...state.turn,
                phase: shared_1.TurnPhase.POST_ROLL,
                pendingDecision: null,
            },
        };
    }
    // =========================================================================
    //  Event Builders (static private)
    //
    //  Event IDs are deterministic: derived from action.actionId + a type suffix
    //  so that replaying the same action always produces identical event IDs.
    // =========================================================================
    static buildCardDrawnEvent(state, action, playerId, cardId, cardText, deckType) {
        return {
            id: `${action.actionId}::CARD_DRAWN::${deckType}`,
            type: shared_1.EventType.CARD_DRAWN,
            roomId: state.roomId,
            gameId: state.id,
            ts: action.clientTs,
            audience: { type: 'ALL' },
            payload: { playerId, cardId, cardText, deckType },
        };
    }
    static buildPlayerJailedEvent(state, action, playerId, reason) {
        return {
            id: `${action.actionId}::PLAYER_JAILED::TILE`,
            type: shared_1.EventType.PLAYER_JAILED,
            roomId: state.roomId,
            gameId: state.id,
            ts: action.clientTs,
            audience: { type: 'ALL' },
            payload: { playerId, reason },
        };
    }
}
exports.TileResolver = TileResolver;
//# sourceMappingURL=TileResolver.js.map