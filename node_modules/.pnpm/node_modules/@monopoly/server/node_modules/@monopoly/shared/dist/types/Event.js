"use strict";
// =============================================================================
// Event.ts
// All server-to-client event types.
//
// Design:
// - Events are facts that have already occurred (past tense).
// - Events are NOT actions. They are the output of the engine.
// - Each event carries an `audience` that controls who receives it.
// - GameEvent is a discriminated union keyed on `type`.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventType = void 0;
// ---------------------------------------------------------------------------
// EventType Enum
// ---------------------------------------------------------------------------
var EventType;
(function (EventType) {
    // Board movement
    EventType["PLAYER_MOVED"] = "PLAYER_MOVED";
    EventType["PLAYER_PASSED_GO"] = "PLAYER_PASSED_GO";
    EventType["EXTRA_TURN_GRANTED"] = "EXTRA_TURN_GRANTED";
    EventType["DICE_ROLLED"] = "DICE_ROLLED";
    // Property
    EventType["PROPERTY_PURCHASED"] = "PROPERTY_PURCHASED";
    EventType["MONOPOLY_COMPLETED"] = "MONOPOLY_COMPLETED";
    EventType["PROPERTY_AUCTIONED_START"] = "PROPERTY_AUCTIONED_START";
    EventType["PROPERTY_AUCTIONED_SOLD"] = "PROPERTY_AUCTIONED_SOLD";
    EventType["PROPERTY_AUCTIONED_UNSOLD"] = "PROPERTY_AUCTIONED_UNSOLD";
    EventType["RENT_CALCULATED"] = "RENT_CALCULATED";
    EventType["RENT_PAID"] = "RENT_PAID";
    EventType["MONOPOLY_RENT_APPLIED"] = "MONOPOLY_RENT_APPLIED";
    EventType["INSUFFICIENT_FUNDS"] = "INSUFFICIENT_FUNDS";
    EventType["HOUSE_BUILT"] = "HOUSE_BUILT";
    EventType["HOTEL_BUILT"] = "HOTEL_BUILT";
    EventType["HOUSE_SOLD"] = "HOUSE_SOLD";
    EventType["HOTEL_SOLD"] = "HOTEL_SOLD";
    EventType["BANK_SHORTAGE"] = "BANK_SHORTAGE";
    EventType["PROPERTY_MORTGAGED"] = "PROPERTY_MORTGAGED";
    EventType["PROPERTY_UNMORTGAGED"] = "PROPERTY_UNMORTGAGED";
    // Auction
    EventType["AUCTION_BID_PLACED"] = "AUCTION_BID_PLACED";
    EventType["AUCTION_EXTENDED"] = "AUCTION_EXTENDED";
    EventType["AUCTION_COMPLETE"] = "AUCTION_COMPLETE";
    // Trade
    EventType["TRADE_PROPOSED"] = "TRADE_PROPOSED";
    EventType["TRADE_COUNTERED"] = "TRADE_COUNTERED";
    EventType["TRADE_ACCEPTED"] = "TRADE_ACCEPTED";
    EventType["TRADE_REJECTED"] = "TRADE_REJECTED";
    EventType["TRADE_CANCELLED"] = "TRADE_CANCELLED";
    EventType["TRADE_EXECUTED"] = "TRADE_EXECUTED";
    // Cards
    EventType["CARD_DRAWN"] = "CARD_DRAWN";
    EventType["CARD_APPLIED"] = "CARD_APPLIED";
    EventType["CARD_MOVED_PLAYER"] = "CARD_MOVED_PLAYER";
    EventType["CARD_MONEY_TRANSFER"] = "CARD_MONEY_TRANSFER";
    EventType["CARD_PLAYER_PAID"] = "CARD_PLAYER_PAID";
    EventType["CARD_PLAYER_RECEIVED"] = "CARD_PLAYER_RECEIVED";
    EventType["CARD_SENT_TO_JAIL"] = "CARD_SENT_TO_JAIL";
    EventType["CARD_ADDED_TO_INVENTORY"] = "CARD_ADDED_TO_INVENTORY";
    EventType["CARD_RETURNED_TO_DECK"] = "CARD_RETURNED_TO_DECK";
    // Jail
    EventType["PLAYER_JAILED"] = "PLAYER_JAILED";
    EventType["PLAYER_RELEASED_JAIL"] = "PLAYER_RELEASED_JAIL";
    // Finance
    EventType["TAX_PAID"] = "TAX_PAID";
    EventType["MONEY_TRANSFERRED"] = "MONEY_TRANSFERRED";
    // Bankruptcy
    EventType["DEBT_RECOVERY_STARTED"] = "DEBT_RECOVERY_STARTED";
    EventType["DEBT_RECOVERY_COMPLETED"] = "DEBT_RECOVERY_COMPLETED";
    EventType["BANKRUPTCY_STARTED"] = "BANKRUPTCY_STARTED";
    EventType["BANKRUPTCY_RESOLVED"] = "BANKRUPTCY_RESOLVED";
    EventType["PLAYER_ELIMINATED"] = "PLAYER_ELIMINATED";
    EventType["PROPERTY_TRANSFERRED"] = "PROPERTY_TRANSFERRED";
    EventType["PROPERTY_RETURNED_TO_BANK"] = "PROPERTY_RETURNED_TO_BANK";
    EventType["DEBT_SETTLED"] = "DEBT_SETTLED";
    EventType["BANKRUPTCY_DECLARED"] = "BANKRUPTCY_DECLARED";
    EventType["ASSETS_TRANSFERRED"] = "ASSETS_TRANSFERRED";
    // Turn / Game lifecycle
    EventType["GAME_STARTED"] = "GAME_STARTED";
    EventType["TURN_STARTED"] = "TURN_STARTED";
    EventType["TURN_ENDED"] = "TURN_ENDED";
    EventType["TURN_TIMED_OUT"] = "TURN_TIMED_OUT";
    EventType["GAME_ENDED"] = "GAME_ENDED";
    // Presence
    EventType["PLAYER_CONNECTED"] = "PLAYER_CONNECTED";
    EventType["PLAYER_DISCONNECTED"] = "PLAYER_DISCONNECTED";
    EventType["PLAYER_RECONNECTED"] = "PLAYER_RECONNECTED";
    // Room
    EventType["HOST_MIGRATED"] = "HOST_MIGRATED";
})(EventType || (exports.EventType = EventType = {}));
//# sourceMappingURL=Event.js.map