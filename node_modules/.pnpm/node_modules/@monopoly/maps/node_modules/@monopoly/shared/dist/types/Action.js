"use strict";
// =============================================================================
// Action.ts
// All client-to-server action types.
//
// Design:
// - Every action carries a client-generated actionId (UUIDv4) for idempotency.
// - playerId is NEVER trusted from the client payload — it is derived from JWT.
// - ClientAction is a discriminated union keyed on `type`.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionType = void 0;
// ---------------------------------------------------------------------------
// ActionType Enum
// ---------------------------------------------------------------------------
/**
 * All valid action types.
 * Actions are the ONLY way clients influence game state.
 * The server validates, applies, and broadcasts; clients only send actions.
 */
var ActionType;
(function (ActionType) {
    // Lobby
    /** Player signals readiness in the lobby. */
    ActionType["ROOM_READY"] = "ROOM_READY";
    /** Host updates room/game settings. */
    ActionType["ROOM_SETTINGS_UPDATE"] = "ROOM_SETTINGS_UPDATE";
    /** Host starts the game. All players must be ready. */
    ActionType["ROOM_START_GAME"] = "ROOM_START_GAME";
    // Turn — Core
    /** Active player rolls the dice. Only valid in PRE_ROLL phase. */
    ActionType["ROLL_DICE"] = "ROLL_DICE";
    /** Player purchases the property they landed on. PURCHASE_DECISION phase. */
    ActionType["BUY_PROPERTY"] = "BUY_PROPERTY";
    /** Player declines to buy; triggers auction if auctionOnDecline is true. */
    ActionType["DECLINE_PROPERTY"] = "DECLINE_PROPERTY";
    /** Player ends their turn. Only valid in POST_ROLL phase. */
    ActionType["END_TURN"] = "END_TURN";
    /** Player applies a drawn Chance/Community Chest card. */
    ActionType["APPLY_CARD"] = "APPLY_CARD";
    // Jail
    /** Player pays the jail fine to be released immediately. */
    ActionType["PAY_JAIL_FINE"] = "PAY_JAIL_FINE";
    /** Player uses a Get Out Of Jail Free card to be released. */
    ActionType["USE_JAIL_CARD"] = "USE_JAIL_CARD";
    /** Player attempts to roll doubles to exit jail (costs nothing). */
    ActionType["ROLL_FOR_DOUBLES"] = "ROLL_FOR_DOUBLES";
    // Property Management (valid in PRE_ROLL or POST_ROLL)
    /** Player mortgages a property they own. */
    ActionType["MORTGAGE_PROPERTY"] = "MORTGAGE_PROPERTY";
    /** Player unmortgages a property they own. */
    ActionType["UNMORTGAGE_PROPERTY"] = "UNMORTGAGE_PROPERTY";
    /** Player builds one house on a property. */
    ActionType["BUILD_HOUSE"] = "BUILD_HOUSE";
    /** Player sells one house from a property back to the bank. */
    ActionType["SELL_HOUSE"] = "SELL_HOUSE";
    /** Player builds a hotel on a property (replaces 4 houses). */
    ActionType["BUILD_HOTEL"] = "BUILD_HOTEL";
    /** Player sells the hotel on a property back to the bank. */
    ActionType["SELL_HOTEL"] = "SELL_HOTEL";
    // Auction
    /** Player places a bid in the active auction. */
    ActionType["PLACE_BID"] = "PLACE_BID";
    /** Player opts out of the current auction (still watches). */
    ActionType["AUCTION_FOLD"] = "AUCTION_FOLD";
    // Trade
    /** Player proposes a trade to another player. */
    ActionType["TRADE_PROPOSE"] = "TRADE_PROPOSE";
    /** Recipient sends a counter-offer. */
    ActionType["TRADE_COUNTER"] = "TRADE_COUNTER";
    /** Player accepts the current trade offer or counter-offer. */
    ActionType["TRADE_ACCEPT"] = "TRADE_ACCEPT";
    /** Player rejects the current trade offer or counter-offer. */
    ActionType["TRADE_REJECT"] = "TRADE_REJECT";
    /** Initiator cancels the trade offer before acceptance. */
    ActionType["TRADE_CANCEL"] = "TRADE_CANCEL";
    // Bankruptcy
    /** Player formally declares bankruptcy when unable to resolve debt. */
    ActionType["DECLARE_BANKRUPTCY"] = "DECLARE_BANKRUPTCY";
    // Meta
    /** Client requests a full state resync (e.g., after detected desync). */
    ActionType["REQUEST_FULL_STATE"] = "REQUEST_FULL_STATE";
})(ActionType || (exports.ActionType = ActionType = {}));
//# sourceMappingURL=Action.js.map