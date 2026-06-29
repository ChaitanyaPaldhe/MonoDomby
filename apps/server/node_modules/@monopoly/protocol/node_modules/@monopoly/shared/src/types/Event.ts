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

import type {
  PlayerId,
  TileId,
  TradeId,
  AuctionId,
  TradeOffer,
  AuctionState,
  TradeState,
} from './GameState.js';
import type {
  JailReason,
  JailReleaseMethod,
  CardDeckType,
} from './Enums.js';

// ---------------------------------------------------------------------------
// EventType Enum
// ---------------------------------------------------------------------------

export enum EventType {
  // Board movement
  PLAYER_MOVED = 'PLAYER_MOVED',
  PLAYER_PASSED_GO = 'PLAYER_PASSED_GO',
  EXTRA_TURN_GRANTED = 'EXTRA_TURN_GRANTED',
  DICE_ROLLED = 'DICE_ROLLED',

  // Property
  PROPERTY_PURCHASED = 'PROPERTY_PURCHASED',
  MONOPOLY_COMPLETED = 'MONOPOLY_COMPLETED',
  PROPERTY_AUCTIONED_START = 'PROPERTY_AUCTIONED_START',
  PROPERTY_AUCTIONED_SOLD = 'PROPERTY_AUCTIONED_SOLD',
  PROPERTY_AUCTIONED_UNSOLD = 'PROPERTY_AUCTIONED_UNSOLD',
  RENT_CALCULATED = 'RENT_CALCULATED',
  RENT_PAID = 'RENT_PAID',
  MONOPOLY_RENT_APPLIED = 'MONOPOLY_RENT_APPLIED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  HOUSE_BUILT = 'HOUSE_BUILT',
  HOTEL_BUILT = 'HOTEL_BUILT',
  HOUSE_SOLD = 'HOUSE_SOLD',
  HOTEL_SOLD = 'HOTEL_SOLD',
  BANK_SHORTAGE = 'BANK_SHORTAGE',
  PROPERTY_MORTGAGED = 'PROPERTY_MORTGAGED',
  PROPERTY_UNMORTGAGED = 'PROPERTY_UNMORTGAGED',

  // Auction
  AUCTION_BID_PLACED = 'AUCTION_BID_PLACED',
  AUCTION_EXTENDED = 'AUCTION_EXTENDED',
  AUCTION_COMPLETE = 'AUCTION_COMPLETE',

  // Trade
  TRADE_PROPOSED = 'TRADE_PROPOSED',
  TRADE_COUNTERED = 'TRADE_COUNTERED',
  TRADE_ACCEPTED = 'TRADE_ACCEPTED',
  TRADE_REJECTED = 'TRADE_REJECTED',
  TRADE_CANCELLED = 'TRADE_CANCELLED',
  TRADE_EXECUTED = 'TRADE_EXECUTED',

  // Cards
  CARD_DRAWN = 'CARD_DRAWN',
  CARD_APPLIED = 'CARD_APPLIED',
  CARD_MOVED_PLAYER = 'CARD_MOVED_PLAYER',
  CARD_MONEY_TRANSFER = 'CARD_MONEY_TRANSFER',
  CARD_PLAYER_PAID = 'CARD_PLAYER_PAID',
  CARD_PLAYER_RECEIVED = 'CARD_PLAYER_RECEIVED',
  CARD_SENT_TO_JAIL = 'CARD_SENT_TO_JAIL',
  CARD_ADDED_TO_INVENTORY = 'CARD_ADDED_TO_INVENTORY',
  CARD_RETURNED_TO_DECK = 'CARD_RETURNED_TO_DECK',

  // Jail
  PLAYER_JAILED = 'PLAYER_JAILED',
  PLAYER_RELEASED_JAIL = 'PLAYER_RELEASED_JAIL',

  // Finance
  TAX_PAID = 'TAX_PAID',
  MONEY_TRANSFERRED = 'MONEY_TRANSFERRED',

  // Bankruptcy
  DEBT_RECOVERY_STARTED = 'DEBT_RECOVERY_STARTED',
  DEBT_RECOVERY_COMPLETED = 'DEBT_RECOVERY_COMPLETED',
  BANKRUPTCY_STARTED = 'BANKRUPTCY_STARTED',
  BANKRUPTCY_RESOLVED = 'BANKRUPTCY_RESOLVED',
  PLAYER_ELIMINATED = 'PLAYER_ELIMINATED',
  PROPERTY_TRANSFERRED = 'PROPERTY_TRANSFERRED',
  PROPERTY_RETURNED_TO_BANK = 'PROPERTY_RETURNED_TO_BANK',
  DEBT_SETTLED = 'DEBT_SETTLED',
  BANKRUPTCY_DECLARED = 'BANKRUPTCY_DECLARED',
  ASSETS_TRANSFERRED = 'ASSETS_TRANSFERRED',

  // Turn / Game lifecycle
  GAME_STARTED = 'GAME_STARTED',
  TURN_STARTED = 'TURN_STARTED',
  TURN_ENDED = 'TURN_ENDED',
  TURN_TIMED_OUT = 'TURN_TIMED_OUT',
  GAME_ENDED = 'GAME_ENDED',

  // Presence
  PLAYER_CONNECTED = 'PLAYER_CONNECTED',
  PLAYER_DISCONNECTED = 'PLAYER_DISCONNECTED',
  PLAYER_RECONNECTED = 'PLAYER_RECONNECTED',

  // Room
  HOST_MIGRATED = 'HOST_MIGRATED',
}

// ---------------------------------------------------------------------------
// Audience
// ---------------------------------------------------------------------------

/**
 * Controls which socket channels receive a given event.
 * The BroadcastService applies this mask before emitting.
 */
export type Audience =
  | { readonly type: 'ALL' }
  | { readonly type: 'PLAYER'; readonly playerId: PlayerId }
  | { readonly type: 'SPECTATORS' }
  | { readonly type: 'PLAYERS_EXCEPT'; readonly excludePlayerIds: readonly PlayerId[] };

// ---------------------------------------------------------------------------
// Event Payload Types
// ---------------------------------------------------------------------------

export interface PlayerMovedPayload {
  readonly playerId: PlayerId;
  readonly fromPosition: number;
  readonly toPosition: number;
  /** Each intermediate tile index the player passed through. */
  readonly pathTaken: readonly number[];
  readonly passedGo: boolean;
}

export interface PlayerPassedGoPayload {
  readonly playerId: PlayerId;
  readonly amount: number;
}

export interface ExtraTurnGrantedPayload {
  readonly playerId: PlayerId;
  readonly reason: 'DOUBLES' | 'CARD';
}

export interface DiceRolledPayload {
  readonly playerId: PlayerId;
  readonly dice: readonly [number, number];
  readonly total: number;
  readonly isDoubles: boolean;
  readonly consecutiveDoubles: number;
}

export interface PropertyPurchasedPayload {
  readonly playerId: PlayerId;
  readonly tileId: TileId;
  readonly price: number;
}

export interface MonopolyCompletedPayload {
  readonly playerId: PlayerId;
  readonly groupId: string;
}

export interface PropertyAuctionedStartPayload {
  readonly tileId: TileId;
  readonly startingBid: number;
  readonly auction: AuctionState;
}

export interface RentCalculatedPayload {
  readonly payerId: PlayerId;
  readonly payeeId: PlayerId | null; // null if paid to bank
  readonly tileId: TileId;
  readonly amount: number;
}

export interface RentPaidPayload {
  readonly payerId: PlayerId;
  readonly payeeId: PlayerId | null; // null if paid to bank
  readonly tileId: TileId;
  readonly amount: number;
}

export interface MonopolyRentAppliedPayload {
  readonly payerId: PlayerId;
  readonly payeeId: PlayerId;
  readonly tileId: TileId;
  readonly groupId: string;
  readonly baseAmount: number;
  readonly newAmount: number;
}

export interface InsufficientFundsPayload {
  readonly playerId: PlayerId;
  readonly creditorId: PlayerId | null; // null if bank
  readonly amountOwed: number;
}

export interface PropertyAuctionedSoldPayload {
  readonly tileId: TileId;
  readonly winnerId: PlayerId;
  readonly finalBid: number;
}

export interface PropertyAuctionedUnsoldPayload {
  readonly tileId: TileId;
}


export interface HouseBuiltPayload {
  readonly playerId: PlayerId;
  readonly tileId: TileId;
  readonly totalHouses: number;
}

export interface HotelBuiltPayload {
  readonly playerId: PlayerId;
  readonly tileId: TileId;
}

export interface HouseSoldPayload {
  readonly playerId: PlayerId;
  readonly tileId: TileId;
  readonly totalHouses: number;
}

export interface HotelSoldPayload {
  readonly playerId: PlayerId;
  readonly tileId: TileId;
}

export interface PropertyMortgagedPayload {
  readonly playerId: PlayerId;
  readonly tileId: TileId;
  readonly mortgageValue: number;
}

export interface PropertyUnmortgagedPayload {
  readonly playerId: PlayerId;
  readonly tileId: TileId;
  readonly unmortgageCost: number;
}

export interface AuctionBidPlacedPayload {
  readonly auctionId: AuctionId;
  readonly playerId: PlayerId;
  readonly amount: number;
  readonly newEndsAt: number;
}

export interface AuctionExtendedPayload {
  readonly auctionId: AuctionId;
  readonly newEndsAt: number;
  readonly extensionCount: number;
}

export interface AuctionCompletePayload {
  readonly auctionId: AuctionId;
  /** Null if no bids were placed. */
  readonly winnerId: PlayerId | null;
  readonly finalBid: number;
  readonly tileId: TileId;
}

export interface TradeProposedPayload {
  readonly tradeId: TradeId;
  readonly initiatorId: PlayerId;
  readonly targetId: PlayerId;
  readonly trade: TradeState;
}

export interface TradeCounteredPayload {
  readonly tradeId: TradeId;
  readonly trade: TradeState;
}

export interface TradeAcceptedPayload {
  readonly tradeId: TradeId;
}

export interface TradeRejectedPayload {
  readonly tradeId: TradeId;
}

export interface TradeCancelledPayload {
  readonly tradeId: TradeId;
}

export interface TradeExecutedPayload {
  readonly tradeId: TradeId;
  readonly initiatorId: PlayerId;
  readonly targetId: PlayerId;
  readonly initiatorReceived: TradeOffer;
  readonly targetReceived: TradeOffer;
}

export interface CardDrawnPayload {
  readonly playerId: PlayerId;
  readonly deckType: CardDeckType;
  readonly cardId: string;
  readonly cardText: string;
}

export interface CardAppliedPayload {
  readonly playerId: PlayerId;
  readonly cardId: string;
  readonly effectType: string;
}

export interface CardMovedPlayerPayload {
  readonly playerId: PlayerId;
  readonly cardId: string;
  readonly toPosition: number;
  readonly passedGo: boolean;
}

export interface CardMoneyTransferPayload {
  readonly playerId: PlayerId;
  readonly cardId: string;
  readonly amount: number;
  readonly toBank: boolean; // true = paid to bank, false = received from bank
}

export interface CardPlayerPaidPayload {
  readonly playerId: PlayerId;
  readonly cardId: string;
  readonly payeeIds: readonly PlayerId[];
  readonly amountPerPlayer: number;
}

export interface CardPlayerReceivedPayload {
  readonly playerId: PlayerId;
  readonly cardId: string;
  readonly payerIds: readonly PlayerId[];
  readonly amountPerPlayer: number;
}

export interface CardSentToJailPayload {
  readonly playerId: PlayerId;
  readonly cardId: string;
}

export interface CardAddedToInventoryPayload {
  readonly playerId: PlayerId;
  readonly cardId: string;
}

export interface CardReturnedToDeckPayload {
  readonly cardId: string;
  readonly deckType: CardDeckType;
}

export interface PlayerJailedPayload {
  readonly playerId: PlayerId;
  readonly reason: JailReason;
}

export interface PlayerReleasedJailPayload {
  readonly playerId: PlayerId;
  readonly method: JailReleaseMethod;
  /** Fine paid when method is PAID_FINE or SERVED_TIME. */
  readonly finePaid: number;
}

export interface TaxPaidPayload {
  readonly playerId: PlayerId;
  readonly amount: number;
  readonly tileName: string;
}

export interface MoneyTransferredPayload {
  /** Null when source is the bank. */
  readonly fromPlayerId: PlayerId | null;
  /** Null when destination is the bank. */
  readonly toPlayerId: PlayerId | null;
  readonly amount: number;
  readonly reason: string;
}

export interface BankruptcyDeclaredPayload {
  readonly playerId: PlayerId;
  /** Null when bankrupt to the bank (e.g., tax). */
  readonly creditorId: PlayerId | null;
}

export interface AssetsTransferredPayload {
  readonly fromPlayerId: PlayerId;
  /** Null when assets return to the bank. */
  readonly toPlayerId: PlayerId | null;
  readonly properties: readonly TileId[];
  readonly money: number;
  readonly jailCards: number;
}

export interface GameStartedPayload {
  readonly playerOrder: readonly PlayerId[];
  readonly startingPositions: Readonly<Record<PlayerId, number>>;
  readonly startingMoney: Readonly<Record<PlayerId, number>>;
}

export interface TurnStartedPayload {
  readonly playerId: PlayerId;
  readonly turnNumber: number;
}

export interface TurnEndedPayload {
  readonly playerId: PlayerId;
  readonly turnNumber: number;
}

export interface TurnTimedOutPayload {
  readonly playerId: PlayerId;
  readonly turnNumber: number;
}

export interface FinalStanding {
  readonly playerId: PlayerId;
  /** 1-based rank. Ties possible. */
  readonly rank: number;
  readonly netWorth: number;
  readonly isBankrupt: boolean;
}

export interface GameEndedPayload {
  readonly winnerId: PlayerId;
  readonly finalStandings: readonly FinalStanding[];
  readonly turnCount: number;
}

export interface PlayerConnectedPayload {
  readonly playerId: PlayerId;
}

export interface PlayerDisconnectedPayload {
  readonly playerId: PlayerId;
}

export interface PlayerReconnectedPayload {
  readonly playerId: PlayerId;
}

export interface BankShortagePayload {
  readonly groupId: string;
  readonly reason: string;
}

export interface HostMigratedPayload {
  readonly newHostId: PlayerId;
  readonly previousHostId: PlayerId;
}


export interface DebtRecoveryStartedPayload {
  readonly playerId: PlayerId;
  readonly creditorId: PlayerId | null;
  readonly amountOwed: number;
}

export interface DebtRecoveryCompletedPayload {
  readonly playerId: PlayerId;
}

export interface BankruptcyStartedPayload {
  readonly playerId: PlayerId;
  readonly creditorId: PlayerId | null;
}

export interface BankruptcyResolvedPayload {
  readonly playerId: PlayerId;
}

export interface PlayerEliminatedPayload {
  readonly playerId: PlayerId;
}

export interface PropertyTransferredPayload {
  readonly fromPlayerId: PlayerId;
  readonly toPlayerId: PlayerId | null;
  readonly properties: readonly TileId[];
}

export interface PropertyReturnedToBankPayload {
  readonly fromPlayerId: PlayerId;
  readonly properties: readonly TileId[];
}

export interface DebtSettledPayload {
  readonly playerId: PlayerId;
  readonly creditorId: PlayerId | null;
  readonly amount: number;
}

// ---------------------------------------------------------------------------
// Base Event Interface
// ---------------------------------------------------------------------------

interface BaseEvent<T extends EventType, P> {
  /** Server-generated UUID for this event. */
  readonly id: string;
  readonly type: T;
  readonly roomId: string;
  readonly gameId: string;
  /** Server timestamp (unix ms) when the event was emitted. */
  readonly ts: number;
  readonly payload: P;
  readonly audience: Audience;
}

// ---------------------------------------------------------------------------
// Concrete Event Types
// ---------------------------------------------------------------------------

export type PlayerMovedEvent = BaseEvent<EventType.PLAYER_MOVED, PlayerMovedPayload>;
export type PlayerPassedGoEvent = BaseEvent<EventType.PLAYER_PASSED_GO, PlayerPassedGoPayload>;
export type ExtraTurnGrantedEvent = BaseEvent<EventType.EXTRA_TURN_GRANTED, ExtraTurnGrantedPayload>;
export type DiceRolledEvent = BaseEvent<EventType.DICE_ROLLED, DiceRolledPayload>;

export type PropertyPurchasedEvent = BaseEvent<EventType.PROPERTY_PURCHASED, PropertyPurchasedPayload>;
export type MonopolyCompletedEvent = BaseEvent<EventType.MONOPOLY_COMPLETED, MonopolyCompletedPayload>;
export type PropertyAuctionedStartEvent = BaseEvent<EventType.PROPERTY_AUCTIONED_START, PropertyAuctionedStartPayload>;
export type PropertyAuctionedSoldEvent = BaseEvent<EventType.PROPERTY_AUCTIONED_SOLD, PropertyAuctionedSoldPayload>;
export type PropertyAuctionedUnsoldEvent = BaseEvent<EventType.PROPERTY_AUCTIONED_UNSOLD, PropertyAuctionedUnsoldPayload>;
export type RentCalculatedEvent = BaseEvent<EventType.RENT_CALCULATED, RentCalculatedPayload>;
export type RentPaidEvent = BaseEvent<EventType.RENT_PAID, RentPaidPayload>;
export type MonopolyRentAppliedEvent = BaseEvent<EventType.MONOPOLY_RENT_APPLIED, MonopolyRentAppliedPayload>;
export type InsufficientFundsEvent = BaseEvent<EventType.INSUFFICIENT_FUNDS, InsufficientFundsPayload>;
export type HouseBuiltEvent = BaseEvent<EventType.HOUSE_BUILT, HouseBuiltPayload>;
export type HotelBuiltEvent = BaseEvent<EventType.HOTEL_BUILT, HotelBuiltPayload>;
export type HouseSoldEvent = BaseEvent<EventType.HOUSE_SOLD, HouseSoldPayload>;
export type HotelSoldEvent = BaseEvent<EventType.HOTEL_SOLD, HotelSoldPayload>;
export type BankShortageEvent = BaseEvent<EventType.BANK_SHORTAGE, BankShortagePayload>;
export type PropertyMortgagedEvent = BaseEvent<EventType.PROPERTY_MORTGAGED, PropertyMortgagedPayload>;
export type PropertyUnmortgagedEvent = BaseEvent<EventType.PROPERTY_UNMORTGAGED, PropertyUnmortgagedPayload>;

export type AuctionBidPlacedEvent = BaseEvent<EventType.AUCTION_BID_PLACED, AuctionBidPlacedPayload>;
export type AuctionExtendedEvent = BaseEvent<EventType.AUCTION_EXTENDED, AuctionExtendedPayload>;
export type AuctionCompleteEvent = BaseEvent<EventType.AUCTION_COMPLETE, AuctionCompletePayload>;

export type TradeProposedEvent = BaseEvent<EventType.TRADE_PROPOSED, TradeProposedPayload>;
export type TradeCounteredEvent = BaseEvent<EventType.TRADE_COUNTERED, TradeCounteredPayload>;
export type TradeAcceptedEvent = BaseEvent<EventType.TRADE_ACCEPTED, TradeAcceptedPayload>;
export type TradeRejectedEvent = BaseEvent<EventType.TRADE_REJECTED, TradeRejectedPayload>;
export type TradeCancelledEvent = BaseEvent<EventType.TRADE_CANCELLED, TradeCancelledPayload>;
export type TradeExecutedEvent = BaseEvent<EventType.TRADE_EXECUTED, TradeExecutedPayload>;

export type CardDrawnEvent = BaseEvent<EventType.CARD_DRAWN, CardDrawnPayload>;
export type CardAppliedEvent = BaseEvent<EventType.CARD_APPLIED, CardAppliedPayload>;
export type CardMovedPlayerEvent = BaseEvent<EventType.CARD_MOVED_PLAYER, CardMovedPlayerPayload>;
export type CardMoneyTransferEvent = BaseEvent<EventType.CARD_MONEY_TRANSFER, CardMoneyTransferPayload>;
export type CardPlayerPaidEvent = BaseEvent<EventType.CARD_PLAYER_PAID, CardPlayerPaidPayload>;
export type CardPlayerReceivedEvent = BaseEvent<EventType.CARD_PLAYER_RECEIVED, CardPlayerReceivedPayload>;
export type CardSentToJailEvent = BaseEvent<EventType.CARD_SENT_TO_JAIL, CardSentToJailPayload>;
export type CardAddedToInventoryEvent = BaseEvent<EventType.CARD_ADDED_TO_INVENTORY, CardAddedToInventoryPayload>;
export type CardReturnedToDeckEvent = BaseEvent<EventType.CARD_RETURNED_TO_DECK, CardReturnedToDeckPayload>;

export type PlayerJailedEvent = BaseEvent<EventType.PLAYER_JAILED, PlayerJailedPayload>;
export type PlayerReleasedJailEvent = BaseEvent<EventType.PLAYER_RELEASED_JAIL, PlayerReleasedJailPayload>;

export type TaxPaidEvent = BaseEvent<EventType.TAX_PAID, TaxPaidPayload>;
export type MoneyTransferredEvent = BaseEvent<EventType.MONEY_TRANSFERRED, MoneyTransferredPayload>;


export type DebtRecoveryStartedEvent = BaseEvent<EventType.DEBT_RECOVERY_STARTED, DebtRecoveryStartedPayload>;
export type DebtRecoveryCompletedEvent = BaseEvent<EventType.DEBT_RECOVERY_COMPLETED, DebtRecoveryCompletedPayload>;
export type BankruptcyStartedEvent = BaseEvent<EventType.BANKRUPTCY_STARTED, BankruptcyStartedPayload>;
export type BankruptcyResolvedEvent = BaseEvent<EventType.BANKRUPTCY_RESOLVED, BankruptcyResolvedPayload>;
export type PlayerEliminatedEvent = BaseEvent<EventType.PLAYER_ELIMINATED, PlayerEliminatedPayload>;
export type PropertyTransferredEvent = BaseEvent<EventType.PROPERTY_TRANSFERRED, PropertyTransferredPayload>;
export type PropertyReturnedToBankEvent = BaseEvent<EventType.PROPERTY_RETURNED_TO_BANK, PropertyReturnedToBankPayload>;
export type DebtSettledEvent = BaseEvent<EventType.DEBT_SETTLED, DebtSettledPayload>;

export type BankruptcyDeclaredEvent = BaseEvent<EventType.BANKRUPTCY_DECLARED, BankruptcyDeclaredPayload>;
export type AssetsTransferredEvent = BaseEvent<EventType.ASSETS_TRANSFERRED, AssetsTransferredPayload>;

export type GameStartedEvent = BaseEvent<EventType.GAME_STARTED, GameStartedPayload>;
export type TurnStartedEvent = BaseEvent<EventType.TURN_STARTED, TurnStartedPayload>;
export type TurnEndedEvent = BaseEvent<EventType.TURN_ENDED, TurnEndedPayload>;
export type TurnTimedOutEvent = BaseEvent<EventType.TURN_TIMED_OUT, TurnTimedOutPayload>;
export type GameEndedEvent = BaseEvent<EventType.GAME_ENDED, GameEndedPayload>;

export type PlayerConnectedEvent = BaseEvent<EventType.PLAYER_CONNECTED, PlayerConnectedPayload>;
export type PlayerDisconnectedEvent = BaseEvent<EventType.PLAYER_DISCONNECTED, PlayerDisconnectedPayload>;
export type PlayerReconnectedEvent = BaseEvent<EventType.PLAYER_RECONNECTED, PlayerReconnectedPayload>;
export type HostMigratedEvent = BaseEvent<EventType.HOST_MIGRATED, HostMigratedPayload>;

// ---------------------------------------------------------------------------
// Discriminated Union
// ---------------------------------------------------------------------------

/**
 * The complete union of all possible server-emitted game events.
 * Switch on `event.type` for exhaustive narrowing.
 */
export type GameEvent =
  | PlayerMovedEvent
  | PlayerPassedGoEvent
  | ExtraTurnGrantedEvent
  | DiceRolledEvent
  | PropertyPurchasedEvent
  | MonopolyCompletedEvent
  | PropertyAuctionedStartEvent
  | PropertyAuctionedSoldEvent
  | PropertyAuctionedUnsoldEvent
  | RentCalculatedEvent
  | RentPaidEvent
  | MonopolyRentAppliedEvent
  | InsufficientFundsEvent
  | HouseBuiltEvent
  | HotelBuiltEvent
  | HouseSoldEvent
  | HotelSoldEvent
  | BankShortageEvent
  | PropertyMortgagedEvent
  | PropertyUnmortgagedEvent
  | AuctionBidPlacedEvent
  | AuctionExtendedEvent
  | AuctionCompleteEvent
  | TradeProposedEvent
  | TradeCounteredEvent
  | TradeAcceptedEvent
  | TradeRejectedEvent
  | TradeCancelledEvent
  | TradeExecutedEvent
  | CardDrawnEvent
  | CardAppliedEvent
  | CardMovedPlayerEvent
  | CardMoneyTransferEvent
  | CardPlayerPaidEvent
  | CardPlayerReceivedEvent
  | CardSentToJailEvent
  | CardAddedToInventoryEvent
  | CardReturnedToDeckEvent
  | PlayerJailedEvent
  | PlayerReleasedJailEvent
  | TaxPaidEvent
  | MoneyTransferredEvent

  | DebtRecoveryStartedEvent
  | DebtRecoveryCompletedEvent
  | BankruptcyStartedEvent
  | BankruptcyResolvedEvent
  | PlayerEliminatedEvent
  | PropertyTransferredEvent
  | PropertyReturnedToBankEvent
  | DebtSettledEvent
  | BankruptcyDeclaredEvent
  | AssetsTransferredEvent
  | GameStartedEvent
  | TurnStartedEvent
  | TurnEndedEvent
  | TurnTimedOutEvent
  | GameEndedEvent
  | PlayerConnectedEvent
  | PlayerDisconnectedEvent
  | PlayerReconnectedEvent
  | HostMigratedEvent;

/**
 * Utility: extract the specific event type for a given EventType key.
 * @example
 * type Rolled = ExtractEvent<EventType.DICE_ROLLED>; // DiceRolledEvent
 */
export type ExtractEvent<T extends EventType> = Extract<GameEvent, { type: T }>;

/**
 * Utility: extract the payload type for a given EventType key.
 * @example
 * type MovedPayload = EventPayload<EventType.PLAYER_MOVED>;
 */
export type EventPayload<T extends EventType> = ExtractEvent<T>['payload'];
