// =============================================================================
// Action.ts
// All client-to-server action types.
//
// Design:
// - Every action carries a client-generated actionId (UUIDv4) for idempotency.
// - playerId is NEVER trusted from the client payload — it is derived from JWT.
// - ClientAction is a discriminated union keyed on `type`.
// =============================================================================

import type { GameSettings } from './GameState.js';
import type { PlayerId, TileId, TradeId, TradeOffer } from './GameState.js';

// ---------------------------------------------------------------------------
// ActionType Enum
// ---------------------------------------------------------------------------

/**
 * All valid action types.
 * Actions are the ONLY way clients influence game state.
 * The server validates, applies, and broadcasts; clients only send actions.
 */
export enum ActionType {
  // Lobby
  /** Player signals readiness in the lobby. */
  ROOM_READY = 'ROOM_READY',
  /** Host updates room/game settings. */
  ROOM_SETTINGS_UPDATE = 'ROOM_SETTINGS_UPDATE',
  /** Host starts the game. All players must be ready. */
  ROOM_START_GAME = 'ROOM_START_GAME',

  // Turn — Core
  /** Active player rolls the dice. Only valid in PRE_ROLL phase. */
  ROLL_DICE = 'ROLL_DICE',
  /** Player purchases the property they landed on. PURCHASE_DECISION phase. */
  BUY_PROPERTY = 'BUY_PROPERTY',
  /** Player declines to buy; triggers auction if auctionOnDecline is true. */
  DECLINE_PROPERTY = 'DECLINE_PROPERTY',
  /** Player ends their turn. Only valid in POST_ROLL phase. */
  END_TURN = 'END_TURN',
  /** Player applies a drawn Chance/Community Chest card. */
  APPLY_CARD = 'APPLY_CARD',

  // Jail
  /** Player pays the jail fine to be released immediately. */
  PAY_JAIL_FINE = 'PAY_JAIL_FINE',
  /** Player uses a Get Out Of Jail Free card to be released. */
  USE_JAIL_CARD = 'USE_JAIL_CARD',
  /** Player attempts to roll doubles to exit jail (costs nothing). */
  ROLL_FOR_DOUBLES = 'ROLL_FOR_DOUBLES',

  // Property Management (valid in PRE_ROLL or POST_ROLL)
  /** Player mortgages a property they own. */
  MORTGAGE_PROPERTY = 'MORTGAGE_PROPERTY',
  /** Player unmortgages a property they own. */
  UNMORTGAGE_PROPERTY = 'UNMORTGAGE_PROPERTY',
  /** Player builds one house on a property. */
  BUILD_HOUSE = 'BUILD_HOUSE',
  /** Player sells one house from a property back to the bank. */
  SELL_HOUSE = 'SELL_HOUSE',
  /** Player builds a hotel on a property (replaces 4 houses). */
  BUILD_HOTEL = 'BUILD_HOTEL',
  /** Player sells the hotel on a property back to the bank. */
  SELL_HOTEL = 'SELL_HOTEL',

  // Auction
  /** Player places a bid in the active auction. */
  PLACE_BID = 'PLACE_BID',
  /** Player opts out of the current auction (still watches). */
  AUCTION_FOLD = 'AUCTION_FOLD',

  // Trade
  /** Player proposes a trade to another player. */
  TRADE_PROPOSE = 'TRADE_PROPOSE',
  /** Recipient sends a counter-offer. */
  TRADE_COUNTER = 'TRADE_COUNTER',
  /** Player accepts the current trade offer or counter-offer. */
  TRADE_ACCEPT = 'TRADE_ACCEPT',
  /** Player rejects the current trade offer or counter-offer. */
  TRADE_REJECT = 'TRADE_REJECT',
  /** Initiator cancels the trade offer before acceptance. */
  TRADE_CANCEL = 'TRADE_CANCEL',

  // Bankruptcy
  /** Player formally declares bankruptcy when unable to resolve debt. */
  DECLARE_BANKRUPTCY = 'DECLARE_BANKRUPTCY',

  // Meta
  /** Client requests a full state resync (e.g., after detected desync). */
  REQUEST_FULL_STATE = 'REQUEST_FULL_STATE',
}

// ---------------------------------------------------------------------------
// Payload Types
// ---------------------------------------------------------------------------

/** No payload required. */
export type EmptyPayload = Record<string, never>;

export interface RoomSettingsUpdatePayload {
  readonly settings: Partial<GameSettings>;
}

export interface BuyPropertyPayload {
  readonly tileId: TileId;
}

export interface DeclinePropertyPayload {
  readonly tileId: TileId;
}

export interface MortgagePropertyPayload {
  readonly tileId: TileId;
}

export interface UnmortgagePropertyPayload {
  readonly tileId: TileId;
}

export interface BuildHousePayload {
  readonly tileId: TileId;
}

export interface SellHousePayload {
  readonly tileId: TileId;
}

export interface BuildHotelPayload {
  readonly tileId: TileId;
}

export interface SellHotelPayload {
  readonly tileId: TileId;
}

export interface PlaceBidPayload {
  readonly amount: number;
}

export interface TradeProposePayload {
  readonly targetId: PlayerId;
  /** Assets the initiator is giving. */
  readonly offer: TradeOffer;
  /** Assets the initiator is requesting. */
  readonly request: TradeOffer;
}

export interface TradeCounterPayload {
  readonly tradeId: TradeId;
  /** Updated offer from the counter-proposing player. */
  readonly offer: TradeOffer;
  /** Updated request from the counter-proposing player. */
  readonly request: TradeOffer;
}

export interface TradeAcceptPayload {
  readonly tradeId: TradeId;
}

export interface TradeRejectPayload {
  readonly tradeId: TradeId;
}

export interface TradeCancelPayload {
  readonly tradeId: TradeId;
}

// ---------------------------------------------------------------------------
// Base Action Interface
// ---------------------------------------------------------------------------

/**
 * Common fields present on every client action.
 * The `type` field drives the discriminated union narrowing.
 */
interface BaseAction<T extends ActionType, P = EmptyPayload> {
  /**
   * Client-generated UUIDv4 used for idempotency.
   * The server caches results by this ID for 60 seconds.
   */
  readonly actionId: string;
  readonly type: T;
  readonly roomId: string;
  /**
   * Client-side timestamp in unix milliseconds.
   * Used by the server to compute client-server clock skew for monitoring.
   * Never trusted for game logic.
   */
  readonly clientTs: number;
  readonly payload: P;
}

// ---------------------------------------------------------------------------
// Concrete Action Types
// ---------------------------------------------------------------------------

export type RoomReadyAction = BaseAction<ActionType.ROOM_READY>;
export type RoomSettingsUpdateAction = BaseAction<ActionType.ROOM_SETTINGS_UPDATE, RoomSettingsUpdatePayload>;
export type RoomStartGameAction = BaseAction<ActionType.ROOM_START_GAME>;

export type RollDiceAction = BaseAction<ActionType.ROLL_DICE>;
export type BuyPropertyAction = BaseAction<ActionType.BUY_PROPERTY, BuyPropertyPayload>;
export type DeclinePropertyAction = BaseAction<ActionType.DECLINE_PROPERTY, DeclinePropertyPayload>;
export type EndTurnAction = BaseAction<ActionType.END_TURN>;
export type ApplyCardAction = BaseAction<ActionType.APPLY_CARD>;

export type PayJailFineAction = BaseAction<ActionType.PAY_JAIL_FINE>;
export type UseJailCardAction = BaseAction<ActionType.USE_JAIL_CARD>;
export type RollForDoublesAction = BaseAction<ActionType.ROLL_FOR_DOUBLES>;

export type MortgagePropertyAction = BaseAction<ActionType.MORTGAGE_PROPERTY, MortgagePropertyPayload>;
export type UnmortgagePropertyAction = BaseAction<ActionType.UNMORTGAGE_PROPERTY, UnmortgagePropertyPayload>;
export type BuildHouseAction = BaseAction<ActionType.BUILD_HOUSE, BuildHousePayload>;
export type SellHouseAction = BaseAction<ActionType.SELL_HOUSE, SellHousePayload>;
export type BuildHotelAction = BaseAction<ActionType.BUILD_HOTEL, BuildHotelPayload>;
export type SellHotelAction = BaseAction<ActionType.SELL_HOTEL, SellHotelPayload>;

export type PlaceBidAction = BaseAction<ActionType.PLACE_BID, PlaceBidPayload>;
export type AuctionFoldAction = BaseAction<ActionType.AUCTION_FOLD>;

export type TradeProposeAction = BaseAction<ActionType.TRADE_PROPOSE, TradeProposePayload>;
export type TradeCounterAction = BaseAction<ActionType.TRADE_COUNTER, TradeCounterPayload>;
export type TradeAcceptAction = BaseAction<ActionType.TRADE_ACCEPT, TradeAcceptPayload>;
export type TradeRejectAction = BaseAction<ActionType.TRADE_REJECT, TradeRejectPayload>;
export type TradeCancelAction = BaseAction<ActionType.TRADE_CANCEL, TradeCancelPayload>;

export type DeclareBankruptcyAction = BaseAction<ActionType.DECLARE_BANKRUPTCY>;
export type RequestFullStateAction = BaseAction<ActionType.REQUEST_FULL_STATE>;

// ---------------------------------------------------------------------------
// Discriminated Union
// ---------------------------------------------------------------------------

/**
 * The complete union of all possible client actions.
 * Switch on `action.type` for exhaustive narrowing.
 */
export type ClientAction =
  | RoomReadyAction
  | RoomSettingsUpdateAction
  | RoomStartGameAction
  | RollDiceAction
  | BuyPropertyAction
  | DeclinePropertyAction
  | EndTurnAction
  | ApplyCardAction
  | PayJailFineAction
  | UseJailCardAction
  | RollForDoublesAction
  | MortgagePropertyAction
  | UnmortgagePropertyAction
  | BuildHouseAction
  | SellHouseAction
  | BuildHotelAction
  | SellHotelAction
  | PlaceBidAction
  | AuctionFoldAction
  | TradeProposeAction
  | TradeCounterAction
  | TradeAcceptAction
  | TradeRejectAction
  | TradeCancelAction
  | DeclareBankruptcyAction
  | RequestFullStateAction;

/**
 * Utility: extract the action type for a given ActionType key.
 * @example
 * type Roll = ExtractAction<ActionType.ROLL_DICE>; // RollDiceAction
 */
export type ExtractAction<T extends ActionType> = Extract<ClientAction, { type: T }>;

/**
 * Utility: extract the payload type for a given ActionType key.
 * @example
 * type BidPayload = ActionPayload<ActionType.PLACE_BID>; // PlaceBidPayload
 */
export type ActionPayload<T extends ActionType> = ExtractAction<T>['payload'];
