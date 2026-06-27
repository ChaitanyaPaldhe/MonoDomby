// =============================================================================
// GameState.ts
// The canonical, authoritative game state shape.
// Designed for JSON serialization (Redis) — uses plain Record<> not Map<>.
// All fields are readonly to enforce immutability at the type level.
// =============================================================================

import type {
  GamePhase,
  TurnPhase,
  AuctionStatus,
  TradeStatus,
  WinCondition,
  DisconnectedPlayerPolicy,
  JailReason,
  DecisionType,
  CardDeckType,
} from './Enums.js';

// ---------------------------------------------------------------------------
// Branded ID types for type safety (prevents mixing IDs)
// ---------------------------------------------------------------------------

/** Opaque branded type for player identifiers. */
export type PlayerId = string & { readonly __brand: 'PlayerId' };
/** Opaque branded type for tile identifiers. */
export type TileId = string & { readonly __brand: 'TileId' };
/** Opaque branded type for trade identifiers. */
export type TradeId = string & { readonly __brand: 'TradeId' };
/** Opaque branded type for auction identifiers. */
export type AuctionId = string & { readonly __brand: 'AuctionId' };
/** Opaque branded type for room identifiers. */
export type RoomId = string & { readonly __brand: 'RoomId' };
/** Opaque branded type for game identifiers. */
export type GameId = string & { readonly __brand: 'GameId' };

/** Type-safe cast helpers. Use only at system boundaries (API input, DB read). */
export const PlayerId = (id: string): PlayerId => id as PlayerId;
export const TileId = (id: string): TileId => id as TileId;
export const TradeId = (id: string): TradeId => id as TradeId;
export const AuctionId = (id: string): AuctionId => id as AuctionId;
export const RoomId = (id: string): RoomId => id as RoomId;
export const GameId = (id: string): GameId => id as GameId;

// ---------------------------------------------------------------------------
// RNG State (xoshiro256++ PRNG)
// Stored in GameState to guarantee deterministic replay from any snapshot.
// ---------------------------------------------------------------------------

/**
 * Internal state of the xoshiro256++ PRNG.
 * Four 32-bit unsigned integers represent the PRNG register.
 * The seed is the original string used to initialise the PRNG (for audit).
 */
export interface RNGState {
  /** Hex-encoded original seed for audit and replay metadata. */
  readonly seed: string;
  /** PRNG register word 0. */
  readonly s0: number;
  /** PRNG register word 1. */
  readonly s1: number;
  /** PRNG register word 2. */
  readonly s2: number;
  /** PRNG register word 3. */
  readonly s3: number;
  /** Monotonically increasing roll counter. Useful for debugging. */
  readonly counter: number;
}

// ---------------------------------------------------------------------------
// Jail State
// ---------------------------------------------------------------------------

/** Present on a PlayerState when the player is currently in jail. */
export interface JailState {
  /** Reason the player was sent to jail. */
  readonly reason: JailReason;
  /** Number of turns the player has already spent in jail (0-based). */
  readonly turnsServed: number;
  /** Server timestamp (unix ms) when they were jailed. */
  readonly jailedAt: number;
}

// ---------------------------------------------------------------------------
// Player State
// ---------------------------------------------------------------------------

/**
 * Complete state for a single player.
 * netWorth is a derived field, recomputed after each state transition.
 */
export interface PlayerState {
  /** Stable player ID (branded). */
  readonly id: PlayerId;
  /** DB user ID (UUID string). */
  readonly userId: string;
  readonly displayName: string;
  readonly avatarUrl: string;
  /** Token ID from MapConfig.meta.playerTokens. */
  readonly tokenId: string;
  /**
   * Zero-based board tile index (0 = GO).
   * Wraps modulo BoardConfig.size on movement.
   */
  readonly position: number;
  /** Current cash balance. Never goes negative; bankruptcy triggers at 0 when debt exists. */
  readonly money: number;
  /** Tile IDs of all properties owned (includes railroads and utilities). */
  readonly properties: readonly TileId[];
  /** Present when the player is currently in jail. Null otherwise. */
  readonly jailState: JailState | null;
  /** Number of Get Out Of Jail Free cards held. */
  readonly getOutOfJailCards: number;
  /** Player has been eliminated from the game. */
  readonly isBankrupt: boolean;
  /** True when a live socket connection exists for this player. */
  readonly isConnected: boolean;
  /** Spectators are read-only observers; this is always false for active players. */
  readonly isSpectator: boolean;
  /**
   * Computed net worth: cash + sum of unmortgaged asset values + building equity.
   * Recomputed server-side after every state transition.
   */
  readonly netWorth: number;
}

// ---------------------------------------------------------------------------
// Board / Tile State
// ---------------------------------------------------------------------------

/**
 * Mutable ownership and development state for a single tile.
 * Keyed by TileId in BoardState.tiles.
 * Only PROPERTY, RAILROAD, and UTILITY tiles have meaningful entries;
 * others may have defaults (ownerId: null, houses: 0, etc.).
 */
export interface TileState {
  readonly tileId: TileId;
  /** ID of the player who owns this tile. Null = bank / unowned. */
  readonly ownerId: PlayerId | null;
  readonly isMortgaged: boolean;
  /** Houses built on this property (0–4). Mutually exclusive with hasHotel. */
  readonly houses: number;
  /** True when a hotel is present. Mutually exclusive with houses > 0. */
  readonly hasHotel: boolean;
}

/** All mutable tile states indexed by tile ID. */
export interface BoardState {
  readonly tiles: Readonly<Record<TileId, TileState>>;
}

// ---------------------------------------------------------------------------
// Bank State
// ---------------------------------------------------------------------------

/**
 * Tracks bank resources.
 * If MapConfig.bank.infiniteMoney is true, the money field is still tracked
 * for accounting but never restricts transactions.
 */
export interface BankState {
  /** Bank's cash on hand. */
  readonly money: number;
  /** Remaining house tokens available for purchase. */
  readonly houses: number;
  /** Remaining hotel tokens available for purchase. */
  readonly hotels: number;
  /**
   * Free Parking pot. Accumulates tax payments when
   * MapConfig.rules.freeParkingMoney is enabled.
   */
  readonly freeParkingPot: number;
}

// ---------------------------------------------------------------------------
// Card Deck State
// ---------------------------------------------------------------------------

/**
 * State of both card decks.
 * Arrays represent ordered draw piles (index 0 = next card to draw).
 * When a draw pile is empty, the discard pile is shuffled to replenish it.
 */
export interface CardDeckState {
  /** Chance draw pile (card IDs from MapConfig.cards.chance). */
  readonly chance: readonly string[];
  readonly communityChest: readonly string[];
  /** Chance discard pile (drawn cards not currently held by a player). */
  readonly chanceDiscard: readonly string[];
  readonly communityChestDiscard: readonly string[];
}

// ---------------------------------------------------------------------------
// Auction State
// ---------------------------------------------------------------------------

/** A single bid in an auction. */
export interface BidEntry {
  readonly playerId: PlayerId;
  readonly amount: number;
  /** Server timestamp (unix ms). */
  readonly timestamp: number;
}

/**
 * Full state of an in-progress auction.
 * Null on GameState when no auction is active.
 */
export interface AuctionState {
  readonly id: AuctionId;
  /** Tile being auctioned. */
  readonly tileId: TileId;
  /** Server timestamp when auction started (unix ms). */
  readonly startedAt: number;
  /** Server timestamp when auction will end unless extended (unix ms). */
  readonly endsAt: number;
  /** Current highest bid amount. 0 if no bids yet. */
  readonly currentBid: number;
  /** Player ID of the highest bidder. Null if no bids. */
  readonly currentBidderId: PlayerId | null;
  /** Ordered bid history (oldest first). */
  readonly bids: readonly BidEntry[];
  /** Player IDs eligible to bid (connected, non-bankrupt). */
  readonly participants: readonly PlayerId[];
  readonly status: AuctionStatus;
  /** Number of times the timer has been extended this auction. */
  readonly extensionCount: number;
}

// ---------------------------------------------------------------------------
// Trade State
// ---------------------------------------------------------------------------

/**
 * One side of a trade offer.
 * Either party can offer cash, properties, and/or jail cards.
 */
export interface TradeOffer {
  readonly money: number;
  readonly properties: readonly TileId[];
  readonly jailCards: number;
}

/** Full state of a trade negotiation between two players. */
export interface TradeState {
  readonly id: TradeId;
  readonly initiatorId: PlayerId;
  readonly targetId: PlayerId;
  /** What the initiator is giving to the target. */
  readonly offer: TradeOffer;
  /** What the initiator is requesting from the target. */
  readonly request: TradeOffer;
  readonly status: TradeStatus;
  /** Server timestamp (unix ms). */
  readonly createdAt: number;
  /** Server timestamp after which the trade auto-cancels (unix ms). */
  readonly expiresAt: number;
}

// ---------------------------------------------------------------------------
// Pending Decision
// ---------------------------------------------------------------------------

/**
 * Represents an action the current player must resolve before the turn can proceed.
 * Stored in TurnState.pendingDecision.
 */
export type PendingDecision =
  | {
      readonly type: DecisionType.PURCHASE;
      /** Tile the player may purchase or decline. */
      readonly tileId: TileId;
    }
  | {
      readonly type: DecisionType.JAIL;
      /** Options available to the player to exit jail. */
      readonly availableOptions: ReadonlyArray<'PAY_FINE' | 'USE_CARD' | 'ROLL'>;
    }
  | {
      readonly type: DecisionType.BANKRUPTCY;
      /** The player or bank that is owed money. Null = owed to bank. */
      readonly creditorId: PlayerId | null;
      /** Total amount that must be raised or debt remains unserviceable. */
      readonly amountOwed: number;
    }
  | {
      readonly type: DecisionType.CARD_EFFECT;
      readonly cardId: string;
      readonly deckType: CardDeckType;
    };

// ---------------------------------------------------------------------------
// Turn State
// ---------------------------------------------------------------------------

/**
 * State machine context for the currently active turn.
 * Replaced wholesale on NEXT_PLAYER.
 */
export interface TurnState {
  /** ID of the player whose turn it currently is. */
  readonly currentPlayerId: PlayerId;
  /** 1-based monotonically increasing turn counter across the entire game. */
  readonly turnNumber: number;
  /** Current sub-phase within this player's turn. */
  readonly phase: TurnPhase;
  /** Dice values from the most recent roll. Null before first roll. */
  readonly diceValues: readonly [number, number] | null;
  readonly isDoubles: boolean;
  /**
   * Count of consecutive doubles rolled this turn.
   * Three consecutive doubles → go to jail.
   */
  readonly consecutiveDoubles: number;
  /**
   * Server timestamp (unix ms) when the turn will auto-end.
   * Refreshed when the player takes action.
   */
  readonly turnExpiresAt: number;
  /**
   * Awaiting mandatory player input before the engine can continue.
   * Engine blocks progress until this is resolved.
   */
  readonly pendingDecision: PendingDecision | null;
}

// ---------------------------------------------------------------------------
// Game Settings (runtime overrides on top of MapConfig defaults)
// ---------------------------------------------------------------------------

/**
 * Per-room game settings. These override or extend MapConfig.rules.
 * Stored on GameState and in the rooms.settings DB column.
 */
export interface GameSettings {
  readonly mapId: string;
  /** 2–8 inclusive. */
  readonly maxPlayers: number;
  /** Seconds a player has to complete their turn before auto-end. */
  readonly turnTimeSeconds: number;
  /** Override MapConfig.rules.auctionConfig.durationSeconds. */
  readonly auctionDurationSeconds: number;
  /** Override MapConfig.bank.startingMoney. */
  readonly startingMoney: number;
  /** Override MapConfig.bank.goReward. */
  readonly goReward: number;
  /** Enable free parking money accumulation house rule. */
  readonly enableFreeParking: boolean;
  /** Enable auctions when a player declines to buy. */
  readonly enableAuctions: boolean;
  readonly disconnectedPlayerPolicy: DisconnectedPlayerPolicy;
  readonly winCondition: WinCondition;
  readonly netWorthTarget: number | null;
  readonly turnLimit: number | null;
  readonly isPrivate: boolean;
}

// ---------------------------------------------------------------------------
// Game Event (inline log entry — full type in Event.ts)
// ---------------------------------------------------------------------------

/**
 * Minimal event reference stored in GameState.eventLog (ring buffer).
 * The full GameEvent type is in Event.ts. Kept separate to avoid circular imports.
 */
export interface GameEventRef {
  readonly id: string;
  readonly type: string;
  readonly ts: number;
  readonly payload: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// GameState (root)
// ---------------------------------------------------------------------------

/**
 * The complete authoritative game state.
 *
 * Design constraints:
 * - Serializable to/from JSON (no Map/Set — use Record/Array).
 * - All fields are readonly to catch accidental mutation at compile time.
 * - The engine never mutates this object; it returns a new one via spread.
 * - `version` is the optimistic-locking counter for Redis atomic writes.
 * - `checksum` is SHA-256 of deterministic fields; verified after each transition.
 */
export interface GameState {
  // --- Identity ---
  /** Unique game instance ID (UUID). */
  readonly id: GameId;
  readonly roomId: RoomId;
  /** References MapConfig.meta.id. Loaded by MapLoaderService at runtime. */
  readonly mapId: string;

  // --- Versioning ---
  /**
   * Monotonically increasing version number.
   * Incremented after every successful state transition.
   * Used for optimistic locking in Redis.
   */
  readonly version: number;

  // --- Phase ---
  readonly phase: GamePhase;

  // --- Players ---
  /** Canonical turn order (array of PlayerId). Never changes during a game. */
  readonly playerOrder: readonly PlayerId[];
  /**
   * Player states keyed by PlayerId.
   * Record<string, PlayerState> for JSON compatibility.
   */
  readonly players: Readonly<Record<PlayerId, PlayerState>>;

  // --- Board ---
  readonly board: BoardState;

  // --- Bank ---
  readonly bank: BankState;

  // --- Cards ---
  readonly cardDecks: CardDeckState;

  // --- Active Subsystems ---
  /** Present when an auction is in progress. Null otherwise. */
  readonly auction: AuctionState | null;
  /** All active trade negotiations keyed by TradeId. */
  readonly activeTrades: Readonly<Record<TradeId, TradeState>>;

  // --- Turn ---
  /**
   * Present when phase === GamePhase.IN_PROGRESS.
   * Contains full turn sub-phase state machine context.
   */
  readonly turn: TurnState;

  // --- Settings ---
  readonly settings: GameSettings;

  // --- Event Log (ring buffer, last 200 events) ---
  readonly eventLog: readonly GameEventRef[];

  // --- Timing ---
  /** Unix ms when this game was created. */
  readonly createdAt: number;
  /** Unix ms of the last accepted action. */
  readonly lastActionAt: number;

  // --- Determinism ---
  /** PRNG state for fully deterministic replay from any snapshot. */
  readonly rngState: RNGState;

  /**
   * SHA-256 hex of a canonical serialisation of deterministic state fields
   * (player money, positions, board ownership, turn number).
   * Verified after each transition to detect state corruption.
   */
  readonly checksum: string;
}
