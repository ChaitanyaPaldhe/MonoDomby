"use strict";
// =============================================================================
// Enums.ts
// All engine-wide enumerations. No external dependencies.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecisionType = exports.RoomStatus = exports.SnapshotReason = exports.ErrorCode = exports.JailReason = exports.JailReleaseMethod = exports.NearestTileType = exports.TaxDestination = exports.DisconnectedPlayerPolicy = exports.WinCondition = exports.CardDeckType = exports.CardEffectType = exports.TileType = exports.TradeStatus = exports.AuctionStatus = exports.TurnPhase = exports.GamePhase = void 0;
// ---------------------------------------------------------------------------
// Game Lifecycle
// ---------------------------------------------------------------------------
/** Top-level phase of a game room. Drives the room-level state machine. */
var GamePhase;
(function (GamePhase) {
    /** Players are joining and configuring settings. No game in progress. */
    GamePhase["LOBBY"] = "LOBBY";
    /** Host has started the game. Countdown, initial state generation in progress. */
    GamePhase["STARTING"] = "STARTING";
    /** Active gameplay. Turn-level state machine is running. */
    GamePhase["IN_PROGRESS"] = "IN_PROGRESS";
    /** Dedicated auction phase overriding turn sequence. */
    GamePhase["AUCTION"] = "AUCTION";
    /** Victory condition met. Game is over. Read-only final state. */
    GamePhase["ENDED"] = "ENDED";
})(GamePhase || (exports.GamePhase = GamePhase = {}));
/** Phase within a single player's turn. Drives the turn-level state machine. */
var TurnPhase;
(function (TurnPhase) {
    /** Turn has begun. Player must roll dice (or manage jail if applicable). */
    TurnPhase["PRE_ROLL"] = "PRE_ROLL";
    /** Dice have been rolled. Awaiting tile-landing resolution. */
    TurnPhase["ROLLED"] = "ROLLED";
    /** Player landed on an unowned purchasable tile. Must buy or decline. */
    TurnPhase["PURCHASE_DECISION"] = "PURCHASE_DECISION";
    /** Player is in jail. Must choose: pay fine, use card, or roll for doubles. */
    TurnPhase["JAIL_DECISION"] = "JAIL_DECISION";
    /** Player has drawn a Chance or Community Chest card. Awaiting resolution. */
    TurnPhase["CARD_DRAWN"] = "CARD_DRAWN";
    /**
     * All landing effects resolved. Player may manage properties,
     * propose trades, or end turn.
     */
    TurnPhase["POST_ROLL"] = "POST_ROLL";
})(TurnPhase || (exports.TurnPhase = TurnPhase = {}));
// ---------------------------------------------------------------------------
// Auction
// ---------------------------------------------------------------------------
/** Lifecycle status of an active auction. */
var AuctionStatus;
(function (AuctionStatus) {
    /** Auction is running; bids are being accepted. */
    AuctionStatus["ACTIVE"] = "ACTIVE";
    /**
     * Auction is in its final countdown (< extensionThreshold seconds remain).
     * A new bid will extend the timer.
     */
    AuctionStatus["ENDING"] = "ENDING";
    /** Auction is over. Winner (or no winner) has been determined. */
    AuctionStatus["COMPLETE"] = "COMPLETE";
})(AuctionStatus || (exports.AuctionStatus = AuctionStatus = {}));
// ---------------------------------------------------------------------------
// Trade
// ---------------------------------------------------------------------------
/** Lifecycle status of a trade offer between two players. */
var TradeStatus;
(function (TradeStatus) {
    /** Initial offer has been sent; awaiting target's response. */
    TradeStatus["PENDING"] = "PENDING";
    /** Target sent a counter-offer; awaiting initiator's response. */
    TradeStatus["COUNTERED"] = "COUNTERED";
    /** Both parties agreed. Assets will be transferred. */
    TradeStatus["ACCEPTED"] = "ACCEPTED";
    /** Target rejected the offer or counter-offer. */
    TradeStatus["REJECTED"] = "REJECTED";
    /** Initiator withdrew the offer. */
    TradeStatus["CANCELLED"] = "CANCELLED";
})(TradeStatus || (exports.TradeStatus = TradeStatus = {}));
// ---------------------------------------------------------------------------
// Map / Board Content
// ---------------------------------------------------------------------------
/** The functional type of a board tile. Determines engine behavior when landed on. */
var TileType;
(function (TileType) {
    /** The GO tile. Passing or landing awards goReward. */
    TileType["GO"] = "GO";
    /** A colour-group property that can be purchased, developed, and mortgaged. */
    TileType["PROPERTY"] = "PROPERTY";
    /** A railroad. Rent scales by number of railroads owned. */
    TileType["RAILROAD"] = "RAILROAD";
    /** A utility (e.g., Electric Company). Rent is dice-roll-based. */
    TileType["UTILITY"] = "UTILITY";
    /** Luxury Tax, Income Tax, etc. Fixed or percentage payment to bank/free parking. */
    TileType["TAX"] = "TAX";
    /** Chance card draw tile. */
    TileType["CHANCE"] = "CHANCE";
    /** Community Chest card draw tile. */
    TileType["COMMUNITY_CHEST"] = "COMMUNITY_CHEST";
    /** Just Visiting / Jail tile. Only a prison when sent here by GO_TO_JAIL or card. */
    TileType["JAIL_VISIT"] = "JAIL_VISIT";
    /** "Go To Jail" tile. Immediately sends the landing player to jail. */
    TileType["GO_TO_JAIL"] = "GO_TO_JAIL";
    /** Free Parking tile. No mandatory effect; may collect tax funds if house rule enabled. */
    TileType["FREE_PARKING"] = "FREE_PARKING";
    /** Extension point: custom tile type driven by customData and a named handler. */
    TileType["CUSTOM"] = "CUSTOM";
})(TileType || (exports.TileType = TileType = {}));
/** Effect type of a Chance or Community Chest card. */
var CardEffectType;
(function (CardEffectType) {
    /** Player receives money from the bank. */
    CardEffectType["COLLECT_FROM_BANK"] = "COLLECT_FROM_BANK";
    /** Player pays money to the bank. */
    CardEffectType["PAY_TO_BANK"] = "PAY_TO_BANK";
    /** Player receives money from each other player. */
    CardEffectType["COLLECT_FROM_PLAYERS"] = "COLLECT_FROM_PLAYERS";
    /** Player pays money to each other player. */
    CardEffectType["PAY_TO_PLAYERS"] = "PAY_TO_PLAYERS";
    /** Player is moved directly to a specific tile by ID. */
    CardEffectType["MOVE_TO_TILE"] = "MOVE_TO_TILE";
    /** Player advances N steps forward. */
    CardEffectType["MOVE_FORWARD"] = "MOVE_FORWARD";
    /** Player moves N steps backward. */
    CardEffectType["MOVE_BACKWARD"] = "MOVE_BACKWARD";
    /** Player advances to the nearest tile of a given type (railroad or utility). */
    CardEffectType["MOVE_TO_NEAREST"] = "MOVE_TO_NEAREST";
    /** Player is immediately sent to jail. */
    CardEffectType["GO_TO_JAIL"] = "GO_TO_JAIL";
    /** Player receives a Get Out Of Jail Free card, stored in PlayerState. */
    CardEffectType["GET_OUT_OF_JAIL_FREE"] = "GET_OUT_OF_JAIL_FREE";
    /** Player pays repair costs per house/hotel owned across all properties. */
    CardEffectType["REPAIRS"] = "REPAIRS";
    /** Invoke a named custom card handler registered in the CardHandlerRegistry. */
    CardEffectType["CUSTOM"] = "CUSTOM";
})(CardEffectType || (exports.CardEffectType = CardEffectType = {}));
/** Identifies which physical card deck a card belongs to. */
var CardDeckType;
(function (CardDeckType) {
    CardDeckType["CHANCE"] = "CHANCE";
    CardDeckType["COMMUNITY_CHEST"] = "COMMUNITY_CHEST";
})(CardDeckType || (exports.CardDeckType = CardDeckType = {}));
// ---------------------------------------------------------------------------
// Rules / Settings
// ---------------------------------------------------------------------------
/** Win condition variant for the game. Read from MapConfig.rules. */
var WinCondition;
(function (WinCondition) {
    /** Last non-bankrupt player wins. Standard Monopoly. */
    WinCondition["LAST_STANDING"] = "LAST_STANDING";
    /** First player to reach a configured net worth target wins. */
    WinCondition["NET_WORTH_TARGET"] = "NET_WORTH_TARGET";
    /** Game ends after a configured number of turns; richest player wins. */
    WinCondition["TURN_LIMIT"] = "TURN_LIMIT";
})(WinCondition || (exports.WinCondition = WinCondition = {}));
/** Behaviour for a disconnected player when it is their turn. */
var DisconnectedPlayerPolicy;
(function (DisconnectedPlayerPolicy) {
    /** Auto-roll dice and skip turn. */
    DisconnectedPlayerPolicy["SKIP"] = "SKIP";
    /** Pause the turn timer and wait for reconnection. */
    DisconnectedPlayerPolicy["WAIT"] = "WAIT";
    /** Server plays the turn automatically (simple heuristic). */
    DisconnectedPlayerPolicy["AUTO_PLAY"] = "AUTO_PLAY";
})(DisconnectedPlayerPolicy || (exports.DisconnectedPlayerPolicy = DisconnectedPlayerPolicy = {}));
/** Where tax payments are sent. */
var TaxDestination;
(function (TaxDestination) {
    /** Standard: money returns to the bank. */
    TaxDestination["BANK"] = "BANK";
    /** House rule: money accumulates on the Free Parking tile. */
    TaxDestination["FREE_PARKING"] = "FREE_PARKING";
})(TaxDestination || (exports.TaxDestination = TaxDestination = {}));
/** The type of tile searched by a MOVE_TO_NEAREST card effect. */
var NearestTileType;
(function (NearestTileType) {
    NearestTileType["RAILROAD"] = "RAILROAD";
    NearestTileType["UTILITY"] = "UTILITY";
})(NearestTileType || (exports.NearestTileType = NearestTileType = {}));
// ---------------------------------------------------------------------------
// Jail
// ---------------------------------------------------------------------------
/** How a player was released from jail. Used in PLAYER_RELEASED_JAIL event. */
var JailReleaseMethod;
(function (JailReleaseMethod) {
    JailReleaseMethod["PAID_FINE"] = "PAID_FINE";
    JailReleaseMethod["USED_CARD"] = "USED_CARD";
    JailReleaseMethod["ROLLED_DOUBLES"] = "ROLLED_DOUBLES";
    /** Player served their maximum allowed turns (maxTurnsInJail) and pays fine. */
    JailReleaseMethod["SERVED_TIME"] = "SERVED_TIME";
})(JailReleaseMethod || (exports.JailReleaseMethod = JailReleaseMethod = {}));
/** How a player was sent to jail. Used in PLAYER_JAILED event. */
var JailReason;
(function (JailReason) {
    JailReason["GO_TO_JAIL_TILE"] = "GO_TO_JAIL_TILE";
    JailReason["THREE_DOUBLES"] = "THREE_DOUBLES";
    JailReason["CARD"] = "CARD";
})(JailReason || (exports.JailReason = JailReason = {}));
// ---------------------------------------------------------------------------
// Error Codes (matches Appendix B of architecture spec)
// ---------------------------------------------------------------------------
/** Typed error codes returned on validation failures. Mapped to HTTP-style semantics. */
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["E_NOT_YOUR_TURN"] = "E_NOT_YOUR_TURN";
    ErrorCode["E_INVALID_PHASE"] = "E_INVALID_PHASE";
    ErrorCode["E_INSUFFICIENT_FUNDS"] = "E_INSUFFICIENT_FUNDS";
    ErrorCode["E_PROPERTY_NOT_OWNED"] = "E_PROPERTY_NOT_OWNED";
    ErrorCode["E_PROPERTY_OWNED"] = "E_PROPERTY_OWNED";
    ErrorCode["E_EVEN_BUILD_VIOLATION"] = "E_EVEN_BUILD_VIOLATION";
    ErrorCode["E_NO_HOUSES_AVAILABLE"] = "E_NO_HOUSES_AVAILABLE";
    ErrorCode["E_NO_HOTELS_AVAILABLE"] = "E_NO_HOTELS_AVAILABLE";
    ErrorCode["E_PROPERTY_MORTGAGED"] = "E_PROPERTY_MORTGAGED";
    ErrorCode["E_NOT_IN_JAIL"] = "E_NOT_IN_JAIL";
    ErrorCode["E_ALREADY_IN_JAIL"] = "E_ALREADY_IN_JAIL";
    ErrorCode["E_TRADE_NOT_FOUND"] = "E_TRADE_NOT_FOUND";
    ErrorCode["E_TRADE_EXPIRED"] = "E_TRADE_EXPIRED";
    ErrorCode["E_AUCTION_ENDED"] = "E_AUCTION_ENDED";
    ErrorCode["E_BID_TOO_LOW"] = "E_BID_TOO_LOW";
    ErrorCode["E_RATE_LIMITED"] = "E_RATE_LIMITED";
    ErrorCode["E_DUPLICATE_ACTION"] = "E_DUPLICATE_ACTION";
    ErrorCode["E_UNAUTHORIZED"] = "E_UNAUTHORIZED";
    ErrorCode["E_ROOM_FULL"] = "E_ROOM_FULL";
    ErrorCode["E_GAME_NOT_STARTED"] = "E_GAME_NOT_STARTED";
    ErrorCode["E_GAME_ENDED"] = "E_GAME_ENDED";
    ErrorCode["E_PENDING_DECISION"] = "E_PENDING_DECISION";
    ErrorCode["E_INVALID_ACTION"] = "E_INVALID_ACTION";
    ErrorCode["E_UNKNOWN"] = "E_UNKNOWN";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
/** Reason a game snapshot was taken. Stored in game_snapshots table. */
var SnapshotReason;
(function (SnapshotReason) {
    SnapshotReason["PERIODIC"] = "PERIODIC";
    SnapshotReason["PRE_AUCTION"] = "PRE_AUCTION";
    SnapshotReason["TRADE"] = "TRADE";
    SnapshotReason["MANUAL"] = "MANUAL";
    SnapshotReason["GAME_END"] = "GAME_END";
})(SnapshotReason || (exports.SnapshotReason = SnapshotReason = {}));
/** Status of a Room record. Mirrors GamePhase but is persisted in the DB. */
var RoomStatus;
(function (RoomStatus) {
    RoomStatus["LOBBY"] = "LOBBY";
    RoomStatus["IN_PROGRESS"] = "IN_PROGRESS";
    RoomStatus["ENDED"] = "ENDED";
})(RoomStatus || (exports.RoomStatus = RoomStatus = {}));
/** Pending decision type stored in TurnState.pendingDecision. */
var DecisionType;
(function (DecisionType) {
    DecisionType["PURCHASE"] = "PURCHASE";
    DecisionType["JAIL"] = "JAIL";
    DecisionType["BANKRUPTCY"] = "BANKRUPTCY";
    DecisionType["CARD_EFFECT"] = "CARD_EFFECT";
    DecisionType["INSUFFICIENT_FUNDS"] = "INSUFFICIENT_FUNDS";
})(DecisionType || (exports.DecisionType = DecisionType = {}));
//# sourceMappingURL=Enums.js.map