/** Top-level phase of a game room. Drives the room-level state machine. */
export declare enum GamePhase {
    /** Players are joining and configuring settings. No game in progress. */
    LOBBY = "LOBBY",
    /** Host has started the game. Countdown, initial state generation in progress. */
    STARTING = "STARTING",
    /** Active gameplay. Turn-level state machine is running. */
    IN_PROGRESS = "IN_PROGRESS",
    /** Dedicated auction phase overriding turn sequence. */
    AUCTION = "AUCTION",
    /** Victory condition met. Game is over. Read-only final state. */
    ENDED = "ENDED"
}
/** Phase within a single player's turn. Drives the turn-level state machine. */
export declare enum TurnPhase {
    /** Turn has begun. Player must roll dice (or manage jail if applicable). */
    PRE_ROLL = "PRE_ROLL",
    /** Dice have been rolled. Awaiting tile-landing resolution. */
    ROLLED = "ROLLED",
    /** Player landed on an unowned purchasable tile. Must buy or decline. */
    PURCHASE_DECISION = "PURCHASE_DECISION",
    /** Player is in jail. Must choose: pay fine, use card, or roll for doubles. */
    JAIL_DECISION = "JAIL_DECISION",
    /** Player has drawn a Chance or Community Chest card. Awaiting resolution. */
    CARD_DRAWN = "CARD_DRAWN",
    /**
     * All landing effects resolved. Player may manage properties,
     * propose trades, or end turn.
     */
    POST_ROLL = "POST_ROLL"
}
/** Lifecycle status of an active auction. */
export declare enum AuctionStatus {
    /** Auction is running; bids are being accepted. */
    ACTIVE = "ACTIVE",
    /**
     * Auction is in its final countdown (< extensionThreshold seconds remain).
     * A new bid will extend the timer.
     */
    ENDING = "ENDING",
    /** Auction is over. Winner (or no winner) has been determined. */
    COMPLETE = "COMPLETE"
}
/** Lifecycle status of a trade offer between two players. */
export declare enum TradeStatus {
    /** Initial offer has been sent; awaiting target's response. */
    PENDING = "PENDING",
    /** Target sent a counter-offer; awaiting initiator's response. */
    COUNTERED = "COUNTERED",
    /** Both parties agreed. Assets will be transferred. */
    ACCEPTED = "ACCEPTED",
    /** Target rejected the offer or counter-offer. */
    REJECTED = "REJECTED",
    /** Initiator withdrew the offer. */
    CANCELLED = "CANCELLED"
}
/** The functional type of a board tile. Determines engine behavior when landed on. */
export declare enum TileType {
    /** The GO tile. Passing or landing awards goReward. */
    GO = "GO",
    /** A colour-group property that can be purchased, developed, and mortgaged. */
    PROPERTY = "PROPERTY",
    /** A railroad. Rent scales by number of railroads owned. */
    RAILROAD = "RAILROAD",
    /** A utility (e.g., Electric Company). Rent is dice-roll-based. */
    UTILITY = "UTILITY",
    /** Luxury Tax, Income Tax, etc. Fixed or percentage payment to bank/free parking. */
    TAX = "TAX",
    /** Chance card draw tile. */
    CHANCE = "CHANCE",
    /** Community Chest card draw tile. */
    COMMUNITY_CHEST = "COMMUNITY_CHEST",
    /** Just Visiting / Jail tile. Only a prison when sent here by GO_TO_JAIL or card. */
    JAIL_VISIT = "JAIL_VISIT",
    /** "Go To Jail" tile. Immediately sends the landing player to jail. */
    GO_TO_JAIL = "GO_TO_JAIL",
    /** Free Parking tile. No mandatory effect; may collect tax funds if house rule enabled. */
    FREE_PARKING = "FREE_PARKING",
    /** Extension point: custom tile type driven by customData and a named handler. */
    CUSTOM = "CUSTOM"
}
/** Effect type of a Chance or Community Chest card. */
export declare enum CardEffectType {
    /** Player receives money from the bank. */
    COLLECT_FROM_BANK = "COLLECT_FROM_BANK",
    /** Player pays money to the bank. */
    PAY_TO_BANK = "PAY_TO_BANK",
    /** Player receives money from each other player. */
    COLLECT_FROM_PLAYERS = "COLLECT_FROM_PLAYERS",
    /** Player pays money to each other player. */
    PAY_TO_PLAYERS = "PAY_TO_PLAYERS",
    /** Player is moved directly to a specific tile by ID. */
    MOVE_TO_TILE = "MOVE_TO_TILE",
    /** Player advances N steps forward. */
    MOVE_FORWARD = "MOVE_FORWARD",
    /** Player moves N steps backward. */
    MOVE_BACKWARD = "MOVE_BACKWARD",
    /** Player advances to the nearest tile of a given type (railroad or utility). */
    MOVE_TO_NEAREST = "MOVE_TO_NEAREST",
    /** Player is immediately sent to jail. */
    GO_TO_JAIL = "GO_TO_JAIL",
    /** Player receives a Get Out Of Jail Free card, stored in PlayerState. */
    GET_OUT_OF_JAIL_FREE = "GET_OUT_OF_JAIL_FREE",
    /** Player pays repair costs per house/hotel owned across all properties. */
    REPAIRS = "REPAIRS",
    /** Invoke a named custom card handler registered in the CardHandlerRegistry. */
    CUSTOM = "CUSTOM"
}
/** Identifies which physical card deck a card belongs to. */
export declare enum CardDeckType {
    CHANCE = "CHANCE",
    COMMUNITY_CHEST = "COMMUNITY_CHEST"
}
/** Win condition variant for the game. Read from MapConfig.rules. */
export declare enum WinCondition {
    /** Last non-bankrupt player wins. Standard Monopoly. */
    LAST_STANDING = "LAST_STANDING",
    /** First player to reach a configured net worth target wins. */
    NET_WORTH_TARGET = "NET_WORTH_TARGET",
    /** Game ends after a configured number of turns; richest player wins. */
    TURN_LIMIT = "TURN_LIMIT"
}
/** Behaviour for a disconnected player when it is their turn. */
export declare enum DisconnectedPlayerPolicy {
    /** Auto-roll dice and skip turn. */
    SKIP = "SKIP",
    /** Pause the turn timer and wait for reconnection. */
    WAIT = "WAIT",
    /** Server plays the turn automatically (simple heuristic). */
    AUTO_PLAY = "AUTO_PLAY"
}
/** Where tax payments are sent. */
export declare enum TaxDestination {
    /** Standard: money returns to the bank. */
    BANK = "BANK",
    /** House rule: money accumulates on the Free Parking tile. */
    FREE_PARKING = "FREE_PARKING"
}
/** The type of tile searched by a MOVE_TO_NEAREST card effect. */
export declare enum NearestTileType {
    RAILROAD = "RAILROAD",
    UTILITY = "UTILITY"
}
/** How a player was released from jail. Used in PLAYER_RELEASED_JAIL event. */
export declare enum JailReleaseMethod {
    PAID_FINE = "PAID_FINE",
    USED_CARD = "USED_CARD",
    ROLLED_DOUBLES = "ROLLED_DOUBLES",
    /** Player served their maximum allowed turns (maxTurnsInJail) and pays fine. */
    SERVED_TIME = "SERVED_TIME"
}
/** How a player was sent to jail. Used in PLAYER_JAILED event. */
export declare enum JailReason {
    GO_TO_JAIL_TILE = "GO_TO_JAIL_TILE",
    THREE_DOUBLES = "THREE_DOUBLES",
    CARD = "CARD"
}
/** Typed error codes returned on validation failures. Mapped to HTTP-style semantics. */
export declare enum ErrorCode {
    E_NOT_YOUR_TURN = "E_NOT_YOUR_TURN",
    E_INVALID_PHASE = "E_INVALID_PHASE",
    E_INSUFFICIENT_FUNDS = "E_INSUFFICIENT_FUNDS",
    E_PROPERTY_NOT_OWNED = "E_PROPERTY_NOT_OWNED",
    E_PROPERTY_OWNED = "E_PROPERTY_OWNED",
    E_EVEN_BUILD_VIOLATION = "E_EVEN_BUILD_VIOLATION",
    E_NO_HOUSES_AVAILABLE = "E_NO_HOUSES_AVAILABLE",
    E_NO_HOTELS_AVAILABLE = "E_NO_HOTELS_AVAILABLE",
    E_PROPERTY_MORTGAGED = "E_PROPERTY_MORTGAGED",
    E_NOT_IN_JAIL = "E_NOT_IN_JAIL",
    E_ALREADY_IN_JAIL = "E_ALREADY_IN_JAIL",
    E_TRADE_NOT_FOUND = "E_TRADE_NOT_FOUND",
    E_TRADE_EXPIRED = "E_TRADE_EXPIRED",
    E_AUCTION_ENDED = "E_AUCTION_ENDED",
    E_BID_TOO_LOW = "E_BID_TOO_LOW",
    E_RATE_LIMITED = "E_RATE_LIMITED",
    E_DUPLICATE_ACTION = "E_DUPLICATE_ACTION",
    E_UNAUTHORIZED = "E_UNAUTHORIZED",
    E_ROOM_FULL = "E_ROOM_FULL",
    E_GAME_NOT_STARTED = "E_GAME_NOT_STARTED",
    E_GAME_ENDED = "E_GAME_ENDED",
    E_PENDING_DECISION = "E_PENDING_DECISION",
    E_INVALID_ACTION = "E_INVALID_ACTION",
    E_UNKNOWN = "E_UNKNOWN"
}
/** Reason a game snapshot was taken. Stored in game_snapshots table. */
export declare enum SnapshotReason {
    PERIODIC = "PERIODIC",
    PRE_AUCTION = "PRE_AUCTION",
    TRADE = "TRADE",
    MANUAL = "MANUAL",
    GAME_END = "GAME_END"
}
/** Status of a Room record. Mirrors GamePhase but is persisted in the DB. */
export declare enum RoomStatus {
    LOBBY = "LOBBY",
    IN_PROGRESS = "IN_PROGRESS",
    ENDED = "ENDED"
}
/** Pending decision type stored in TurnState.pendingDecision. */
export declare enum DecisionType {
    PURCHASE = "PURCHASE",
    JAIL = "JAIL",
    BANKRUPTCY = "BANKRUPTCY",
    CARD_EFFECT = "CARD_EFFECT",
    INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS"
}
//# sourceMappingURL=Enums.d.ts.map