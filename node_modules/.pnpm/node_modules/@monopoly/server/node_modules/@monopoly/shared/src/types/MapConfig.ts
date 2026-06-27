// =============================================================================
// MapConfig.ts
// All types describing a Monopoly map configuration JSON.
// A new theme is playable by supplying a valid MapConfig — zero engine changes.
// =============================================================================

import type {
  TileType,
  CardEffectType,
  CardDeckType,
  WinCondition,
  DisconnectedPlayerPolicy,
  TaxDestination,
  NearestTileType,
} from './Enums.js';

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

/** A player token available on this map (avatar / piece). */
export interface PlayerToken {
  /** Unique stable ID for this token, e.g. "top-hat". */
  readonly id: string;
  /** Display label, e.g. "Top Hat". */
  readonly name: string;
  /** URL of the token icon asset. */
  readonly iconUrl: string;
}

/** Metadata block for a map. */
export interface MapMeta {
  /** Globally unique map ID. Should be a slug, e.g. "classic". */
  readonly id: string;
  /** Human-readable display name, e.g. "Classic Monopoly". */
  readonly name: string;
  /** Optional description shown in the lobby. */
  readonly description?: string;
  /** URL of the thumbnail image shown in map selection. */
  readonly thumbnailUrl?: string;
  /** Available player tokens for this map. Between 2 and 8. */
  readonly playerTokens: readonly PlayerToken[];
}

// ---------------------------------------------------------------------------
// Bank
// ---------------------------------------------------------------------------

/** Bank configuration. Controls starting money, token counts, and the GO reward. */
export interface BankConfig {
  /** Amount of money each player receives at game start. */
  readonly startingMoney: number;
  /**
   * If true, the bank has unlimited money and will never run out.
   * If false, bank.money is tracked and the bank can run out of notes.
   */
  readonly infiniteMoney: boolean;
  /** Number of house tokens the bank begins with. Default: 32. */
  readonly initialHouses: number;
  /** Number of hotel tokens the bank begins with. Default: 12. */
  readonly initialHotels: number;
  /** Amount awarded for landing on or passing GO. Default: 200. */
  readonly goReward: number;
}

// ---------------------------------------------------------------------------
// Tile Data Sub-types
// ---------------------------------------------------------------------------

/**
 * Rent schedule for a property tile.
 * colorGroup is the rent when the owner holds ALL properties in the group
 * but has built no houses yet (monopoly bonus rent).
 */
export interface PropertyRents {
  readonly base: number;
  /** Rent with a full-color-group monopoly (no houses). Often 2× base. */
  readonly colorGroup: number;
  readonly oneHouse: number;
  readonly twoHouses: number;
  readonly threeHouses: number;
  readonly fourHouses: number;
  readonly hotel: number;
}

/** Data attached to a PROPERTY type tile. */
export interface PropertyData {
  /** ID of the PropertyGroup this property belongs to. */
  readonly groupId: string;
  /** Purchase price from the bank. */
  readonly price: number;
  /** Rent schedule. */
  readonly rents: PropertyRents;
  /** Cost to place one house on this property. */
  readonly houseCost: number;
  /** Cost to place a hotel (replaces 4 houses) on this property. */
  readonly hotelCost: number;
  /**
   * Value received from the bank when mortgaging.
   * Standard Monopoly: price / 2.
   */
  readonly mortgageValue: number;
  /**
   * Cost to unmortgage (lift the mortgage).
   * Standard Monopoly: mortgageValue * 1.1.
   */
  readonly unmortgageCost: number;
}

/**
 * Data attached to a RAILROAD type tile.
 * rents[0] = owning 1 railroad, rents[3] = owning all 4.
 */
export interface RailroadData {
  readonly price: number;
  /** Exactly 4 values. Index = (railroads owned - 1). */
  readonly rents: readonly [number, number, number, number];
  readonly mortgageValue: number;
  readonly unmortgageCost: number;
}

/**
 * Data attached to a UTILITY type tile.
 * diceMultipliers[0] = owning 1 utility, diceMultipliers[1] = owning both.
 * Rent = dice total × multiplier.
 */
export interface UtilityData {
  readonly price: number;
  /** Exactly 2 values. */
  readonly diceMultipliers: readonly [number, number];
  readonly mortgageValue: number;
  readonly unmortgageCost: number;
}

/** Data attached to a TAX type tile. */
export interface TaxData {
  /**
   * Fixed amount to pay.
   * If isPercentage is true, this is ignored and percentage is used instead.
   */
  readonly amount: number;
  /** If true, tax = player netWorth × percentage. */
  readonly isPercentage: boolean;
  /** Fraction of net worth (0–1). Only used when isPercentage is true. */
  readonly percentage?: number;
  /** Where the tax payment goes. */
  readonly destination: TaxDestination;
}

// ---------------------------------------------------------------------------
// Tile
// ---------------------------------------------------------------------------

/** Board coordinates for rendering the tile in the client. */
export interface TileCoordinates {
  readonly x: number;
  readonly y: number;
}

/**
 * A single board tile.
 * Only one of propertyData / railroadData / utilityData / taxData / customData
 * should be present, matching the tile's type.
 */
export interface Tile {
  /** Unique stable tile ID, e.g. "boardwalk" or "go". */
  readonly id: string;
  /** Zero-based position on the board. Determines movement order. */
  readonly index: number;
  /** Functional type that drives engine behaviour. */
  readonly type: TileType;
  /** Display name, e.g. "Boardwalk". */
  readonly name: string;
  /** Rendering hint for the client board canvas. */
  readonly coordinates?: TileCoordinates;
  readonly propertyData?: PropertyData;
  readonly railroadData?: RailroadData;
  readonly utilityData?: UtilityData;
  readonly taxData?: TaxData;
  /** Arbitrary data consumed by custom tile handlers. */
  readonly customData?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Property Groups
// ---------------------------------------------------------------------------

/** A colour group (e.g. "Dark Blue" containing Boardwalk and Park Place). */
export interface PropertyGroup {
  /** Unique group ID, e.g. "dark-blue". */
  readonly id: string;
  readonly name: string;
  /** Hex colour for UI rendering, e.g. "#003366". */
  readonly color: string;
  /** Ordered tile IDs belonging to this group. */
  readonly tileIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/** Effect triggered when a card is drawn. */
export interface CardEffect {
  readonly type: CardEffectType;
  /** Fixed monetary amount for collect/pay effects. */
  readonly amount?: number;
  /** Target tile ID for MOVE_TO_TILE effect. */
  readonly tileId?: string;
  /** Number of steps for MOVE_FORWARD / MOVE_BACKWARD. */
  readonly steps?: number;
  /** Tile type to advance to for MOVE_TO_NEAREST. */
  readonly nearestType?: NearestTileType;
  /**
   * If true and MOVE_TO_NEAREST causes landing on that tile,
   * rent is doubled (standard railroad card rule).
   */
  readonly collectDoubleRent?: boolean;
  /** Repair costs per development for the REPAIRS card effect. */
  readonly repairCosts?: {
    readonly perHouse: number;
    readonly perHotel: number;
  };
  /**
   * ID of a named custom handler registered in CardHandlerRegistry.
   * Only used when type === CardEffectType.CUSTOM.
   */
  readonly customHandler?: string;
}

/** A single Chance or Community Chest card. */
export interface CardConfig {
  /** Unique stable card ID within the map. */
  readonly id: string;
  /** Display text shown to the player when card is drawn. */
  readonly text: string;
  readonly effect: CardEffect;
  /** Which deck this card belongs to. */
  readonly deckType: CardDeckType;
}

// ---------------------------------------------------------------------------
// Auction Config
// ---------------------------------------------------------------------------

/** Auction subsystem parameters, nested under RulesConfig. */
export interface AuctionConfig {
  /** Total duration in seconds for a fresh auction. Default: 30. */
  readonly durationSeconds: number;
  /** Seconds added to the auction when a bid arrives near the end. Default: 10. */
  readonly extensionSeconds: number;
  /**
   * If a bid arrives when remaining time ≤ extensionThreshold seconds,
   * the timer is extended. Default: 5.
   */
  readonly extensionThreshold: number;
  /** Minimum amount a bid must exceed the current bid. Default: 10. */
  readonly minBidIncrement: number;
  /** Maximum number of timer extensions per auction. Default: 10. */
  readonly maxExtensions: number;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/** All configurable game rules. Every Monopoly mechanic driven from here. */
export interface RulesConfig {
  /** If a player declines to purchase, trigger an auction. Default: true. */
  readonly auctionOnDecline: boolean;
  /** Enforce the even-building rule (no property can have more than 1 house over any other in the group). Default: true. */
  readonly evenBuildingRequired: boolean;
  /** Maximum consecutive turns a player may spend in jail before being forced out. Default: 3. */
  readonly maxTurnsInJail: number;
  /** Amount a player must pay to exit jail without rolling doubles. Default: 50. */
  readonly jailFine: number;
  /** Allow rolling dice to attempt doubles for jail release. Default: true. */
  readonly doublesForJailRelease: boolean;
  /** House rule: tax payments accumulate on Free Parking and are won by the next player to land there. Default: false. */
  readonly freeParkingMoney: boolean;
  /** If true, bankrupt player's assets go to the bank, not the creditor. Default: false. */
  readonly bankruptcyToBank: boolean;
  /** Victory condition variant. */
  readonly winCondition: WinCondition;
  /** Net worth target when winCondition === NET_WORTH_TARGET. */
  readonly netWorthTarget?: number;
  /** Turn limit when winCondition === TURN_LIMIT. */
  readonly turnLimit?: number;
  /** Auction configuration. */
  readonly auctionConfig: AuctionConfig;
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

/** Top-level board configuration. */
export interface BoardConfig {
  /**
   * Total number of tiles on the board.
   * Player positions wrap modulo this value.
   */
  readonly size: number;
  /**
   * All tiles in the game. Must be ordered by index (0 = GO, 1 = next tile, etc.).
   * Tile index must match its position in this array.
   */
  readonly tiles: readonly Tile[];
  /** All colour property groups. */
  readonly propertyGroups: readonly PropertyGroup[];
  /** Index of the Jail/Just Visiting tile. */
  readonly jailTileIndex: number;
}

// ---------------------------------------------------------------------------
// Root MapConfig
// ---------------------------------------------------------------------------

/**
 * The complete configuration for a Monopoly map.
 * The engine never contains hardcoded game content — all content comes from here.
 *
 * @example
 * const config: MapConfig = require('./maps/classic.json');
 */
export interface MapConfig {
  /** Schema version for forward-compatibility checks, e.g. "1.0". */
  readonly schemaVersion: string;
  readonly meta: MapMeta;
  readonly bank: BankConfig;
  readonly board: BoardConfig;
  readonly cards: {
    readonly chance: readonly CardConfig[];
    readonly communityChest: readonly CardConfig[];
  };
  readonly rules: RulesConfig;
}
