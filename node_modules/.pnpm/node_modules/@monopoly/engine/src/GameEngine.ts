// =============================================================================
// engine/GameEngine.ts
// The main engine orchestrator.
//
// This is the ONLY public entry point into the game logic.
//
// Design:
// - Pure function: apply(state, action, mapConfig) → { newState, events }
// - No I/O, no side effects, no framework dependencies.
//   Exception: createInitialState uses node:crypto for seeding — but this
//   is initialisation, not gameplay, and the CSPRNG call is isolated here.
// - Coordinates ActionProcessor, StateMachine, WinDetector, RuleEngine.
// - Plugins are registered at construction time.
// =============================================================================

import { createHash, randomBytes } from 'node:crypto';

import {
  GamePhase,
  TurnPhase,
  DisconnectedPlayerPolicy,
  EventType,
} from '@monopoly/shared';
import type {
  GameState,
  PlayerState,
  TileState,
  BoardState,
  BankState,
  CardDeckState,
  TurnState,
  GameSettings,
  GameEventRef,
  TradeState,
  PlayerId,
  TileId,
  TradeId,
  RoomId,
  GameId,
} from '@monopoly/shared';
import type { MapConfig } from '@monopoly/maps';;
import type { ClientAction, GameEvent, GameStartedEvent } from '@monopoly/shared';

import type {
  EngineResult,
  CreateGameParams,
  EnginePlugin,
  ValidationResult,
} from './types.js';
import { EngineValidationError, EngineNotImplementedError } from './errors.js';
import { ActionProcessor } from './ActionProcessor.js';
import type { CustomTileHandlerFn } from './TileResolver.js';
import { StateMachine } from './StateMachine.js';
import { WinDetector } from './WinDetector.js';
import { RuleEngine } from './RuleEngine.js';
import { DiceEngine } from './DiceEngine.js';
import { CardEngine } from './CardEngine.js';

// ---------------------------------------------------------------------------
// GameEngine
// ---------------------------------------------------------------------------

/**
 * The Monopoly game engine.
 *
 * ### Core Contract
 * ```
 * apply(state, action, mapConfig, actingPlayerId) → { newState, events }
 * ```
 * - Deterministic: same inputs always produce the same output.
 * - Pure: no side effects, no I/O, no global state.
 * - Immutable: input `state` is never mutated.
 *
 * ### Usage
 * ```typescript
 * const engine = new GameEngine();
 *
 * // Game initialisation (call once, persist the result to Redis)
 * const { newState, events } = GameEngine.createInitialState(params);
 *
 * // Per-action (every player action in the running game)
 * // actingPlayerId is extracted from the verified JWT by the Socket.IO middleware
 * const { newState, events } = engine.apply(currentState, action, mapConfig, actingPlayerId);
 * ```
 */
export class GameEngine {
  private readonly actionProcessor: ActionProcessor;
  private readonly stateMachine: StateMachine;
  private readonly winDetector: WinDetector;
  private readonly ruleEngine: RuleEngine;
  private readonly plugins: readonly EnginePlugin[];

  /**
   * @param plugins            Optional engine plugins for post-turn hooks.
   * @param customTileHandlers Optional map of tile-ID → handler for CUSTOM tiles.
   *                           Provide when loading a MapConfig that uses TileType.CUSTOM.
   */
  constructor(
    plugins: readonly EnginePlugin[] = [],
    customTileHandlers?: ReadonlyMap<string, CustomTileHandlerFn>,
  ) {
    this.stateMachine = new StateMachine();
    this.actionProcessor = new ActionProcessor(this.stateMachine, customTileHandlers);
    this.winDetector = new WinDetector();
    this.ruleEngine = new RuleEngine();
    this.plugins = plugins;

    this.registerCoreRules();
    this.registerPlugins(plugins);
  }

  // -------------------------------------------------------------------------
  // Core Public API
  // -------------------------------------------------------------------------

  /**
   * The primary engine entry point.
   *
   * Pipeline:
   * 1. Validate action (uses actingPlayerId from JWT, never from payload).
   * 2. Apply action handler → intermediate { newState, events }.
   * 3. Run rule pipeline.
   * 4. Check win condition.
   * 5. If game won: transition to ENDED, emit GAME_ENDED event.
   * 6. Return final { newState, events }.
   *
   * @param state          Current authoritative game state (loaded from Redis).
   * @param action         Validated client action.
   * @param mapConfig      Map configuration for this room.
   * @param actingPlayerId JWT-verified player identity. NEVER from payload.
   *
   * @throws {EngineValidationError}     Caught by server → emits ACTION_REJECTED.
   * @throws {EngineNotImplementedError} TODO stub handlers during development.
   */
  apply(
    state: GameState,
    action: ClientAction,
    mapConfig: MapConfig,
    actingPlayerId: PlayerId,
  ): EngineResult {
    // Step 1: Validate
    const validation = this.actionProcessor.validate(state, action, mapConfig, actingPlayerId);
    if (!validation.valid) {
      throw new EngineValidationError(validation.reason, validation.code);
    }

    // Step 2: Apply action handler
    const intermediate = this.actionProcessor.apply(state, action, mapConfig, actingPlayerId);

    // Step 3: Run rule pipeline
    const stateAfterRules = this.ruleEngine.applyAll(intermediate.newState, {
      playerId: actingPlayerId,
      mapConfig,
    });

    // Step 4: Check win condition
    const winResult = this.winDetector.check(stateAfterRules, mapConfig);

    if (winResult.won) {
      // Step 5: Transition to ENDED
      const endedState = this.stateMachine.transitionGame(stateAfterRules, GamePhase.ENDED);
      const finalState = {
        ...endedState,
        checksum: GameEngine.computeChecksum(endedState),
      };
      // TODO: Build full GAME_ENDED event with final standings
      return { newState: finalState, events: [...intermediate.events] };
    }

    const finalState = {
      ...stateAfterRules,
      checksum: GameEngine.computeChecksum(stateAfterRules),
    };

    return { newState: finalState, events: intermediate.events };
  }

  /**
   * Validate an action without applying it.
   * Useful for client-side pre-flight checks and idempotency guards.
   *
   * @param actingPlayerId JWT-verified player identity.
   */
  validate(
    state: GameState,
    action: ClientAction,
    mapConfig: MapConfig,
    actingPlayerId: PlayerId,
  ): ValidationResult {
    return this.actionProcessor.validate(state, action, mapConfig, actingPlayerId);
  }

  // -------------------------------------------------------------------------
  // State Creation
  // -------------------------------------------------------------------------

  /**
   * Create the initial GameState for a new game.
   *
   * This is the ONLY place the engine performs I/O (crypto.randomBytes for seed
   * generation when no explicit seed is provided). All subsequent calls are pure.
   *
   * Initialisation sequence:
   *  1.  Validate player count (2–8).
   *  2.  Generate (or use provided) RNG seed → RNGState.
   *  3.  Build GameSettings from MapConfig + settingsOverrides.
   *  4.  Shuffle Chance and Community Chest decks using the PRNG.
   *  5.  Build playerOrder (preserves params.players array order).
   *  6.  Build each PlayerState:
   *        position = 0 (GO), money = startingMoney, properties = [],
   *        jailState = null, getOutOfJailCards = 0, isBankrupt = false.
   *  7.  Build BoardState: all tiles unowned, no houses/hotels.
   *  8.  Build BankState: houses/hotels from MapConfig, money computed.
   *  9.  Build TurnState for the first player in PRE_ROLL phase.
   * 10.  Assemble GameState with version = 1, phase = IN_PROGRESS.
   * 11.  Compute SHA-256 checksum over deterministic fields.
   * 12.  Build GAME_STARTED GameEvent (broadcast) and GameEventRef (eventLog).
   * 13.  Return { newState, events: [GAME_STARTED] }.
   *
   * @param params - Game creation parameters including players, mapConfig, and optional seed.
   * @returns EngineResult with the initial GameState and GAME_STARTED event.
   * @throws Error if fewer than 2 or more than 8 players are provided.
   */
  static createInitialState(params: CreateGameParams): EngineResult {
    const { mapConfig, players, createdAt } = params;

    // --- Guard: player count ---
    if (players.length < 2) {
      throw new Error(
        `[GameEngine] At least 2 players are required to start a game. Received: ${players.length}.`,
      );
    }
    if (players.length > 8) {
      throw new Error(
        `[GameEngine] Maximum 8 players supported. Received: ${players.length}.`,
      );
    }

    // 1. RNG seed (use provided or generate from CSPRNG)
    const rngSeed = params.rngSeed ?? randomBytes(32).toString('hex');

    // 2. Initialise PRNG from seed + gameId (gameId mixes in uniqueness)
    let rngState = DiceEngine.createRNGState(rngSeed, params.gameId);

    // 3. Build GameSettings
    const settings = GameEngine.buildGameSettings(
      mapConfig,
      params.settingsOverrides,
      players.length,
    );

    // 4. Shuffle card decks (advances PRNG state)
    const cardEngine = new CardEngine();
    const [cardDecks, nextRngState] = cardEngine.buildInitialDecks(mapConfig, rngState);
    rngState = nextRngState;

    // 5. Player order (input order is canonical turn order)
    const playerOrder: PlayerId[] = players.map(p => p.playerId);

    // 6. Player states
    const startingMoney = settings.startingMoney;
    const playerStates = {} as Record<PlayerId, PlayerState>;
    for (const playerInfo of players) {
      playerStates[playerInfo.playerId] = {
        id: playerInfo.playerId,
        userId: playerInfo.userId,
        displayName: playerInfo.displayName,
        avatarUrl: playerInfo.avatarUrl,
        tokenId: playerInfo.tokenId,
        position: 0,            // All players start at GO (tile index 0)
        money: startingMoney,   // From MapConfig.bank.startingMoney or override
        properties: [],
        jailState: null,
        getOutOfJailCards: 0,
        isBankrupt: false,
        isConnected: true,      // Assume connected at game start
        isSpectator: false,
        netWorth: startingMoney, // Initial netWorth = cash (no assets yet)
      };
    }

    // 7. Board state — all tiles unowned, no buildings
    const tileStates = {} as Record<TileId, TileState>;
    for (const tile of mapConfig.board.tiles) {
      const tileId = tile.id as TileId;
      tileStates[tileId] = {
        tileId,
        ownerId: null,
        isMortgaged: false,
        houses: 0,
        hasHotel: false,
      };
    }
    const board: BoardState = { tiles: tileStates };

    // 8. Bank state
    const bank: BankState = {
      money: mapConfig.bank.infiniteMoney
        ? Number.MAX_SAFE_INTEGER
        : GameEngine.computeInitialBankMoney(mapConfig, players.length, startingMoney),
      houses: mapConfig.bank.initialHouses,
      hotels: mapConfig.bank.initialHotels,
      freeParkingPot: 0,
    };

    // 9. Turn state — first player, PRE_ROLL phase
    const firstPlayerId = playerOrder[0]!;
    const turn: TurnState = {
      currentPlayerId: firstPlayerId,
      turnNumber: 1,
      phase: TurnPhase.PRE_ROLL,
      diceValues: null,
      isDoubles: false,
      consecutiveDoubles: 0,
      turnExpiresAt: createdAt + settings.turnTimeSeconds * 1000,
      pendingDecision: null,
    };

    // 10. Assemble state (checksum placeholder = empty string)
    const stateForChecksum: GameState = {
      id: params.gameId as GameId,
      roomId: params.roomId as RoomId,
      mapId: mapConfig.meta.id,
      version: 1,
      phase: GamePhase.IN_PROGRESS,
      playerOrder,
      players: playerStates,
      board,
      bank,
      cardDecks,
      pendingCard: null,
      auction: null,
      activeTrades: {} as Readonly<Record<TradeId, TradeState>>,
      turn,
      settings,
      eventLog: [],          // Populated below after building the event
      createdAt,
      lastActionAt: createdAt,
      rngState,
      checksum: '',          // Computed in step 11
    };

    // 11. Compute checksum over deterministic state fields
    const checksum = GameEngine.computeChecksum(stateForChecksum);

    // 12. Build GAME_STARTED event.
    //     The event ID is derived deterministically from the gameId so that
    //     calling createInitialState twice with the same params yields identical results.
    const eventId = createHash('sha256')
      .update(`game-started:${params.gameId}`)
      .digest('hex');

    const startingPositions = {} as Record<string, number>;
    const startingMoneyRecord = {} as Record<string, number>;
    for (const pid of playerOrder) {
      startingPositions[pid] = 0;
      startingMoneyRecord[pid] = startingMoney;
    }

    const gameStartedEvent: GameStartedEvent = {
      id: eventId,
      type: EventType.GAME_STARTED,
      roomId: params.roomId,
      gameId: params.gameId,
      ts: createdAt,
      payload: {
        playerOrder,
        startingPositions: startingPositions as Record<PlayerId, number>,
        startingMoney: startingMoneyRecord as Record<PlayerId, number>,
      },
      audience: { type: 'ALL' },
    };

    // 13. GameEventRef for the eventLog ring buffer
    const gameStartedRef: GameEventRef = {
      id: eventId,
      type: EventType.GAME_STARTED,
      ts: createdAt,
      payload: startingPositions as Readonly<Record<string, unknown>>,
    };

    // 14. Final state with checksum + initial event in log
    const initialState: GameState = {
      ...stateForChecksum,
      checksum,
      eventLog: [gameStartedRef],
    };

    return {
      newState: initialState,
      events: [gameStartedEvent as GameEvent],
    };
  }

  /**
   * Rehydrate a GameState from a stored snapshot.
   * Validates the checksum before returning.
   *
   * TODO: Implement — parse, validate types, verify checksum, throw on mismatch.
   */
  static fromSnapshot(_snapshot: unknown): GameState {
    throw new EngineNotImplementedError('GameEngine.fromSnapshot');
  }

  // -------------------------------------------------------------------------
  // Checksum
  // -------------------------------------------------------------------------

  /**
   * Compute the SHA-256 checksum over the deterministic subset of GameState.
   *
   * Fields included (these are the fields that change during gameplay):
   * - version
   * - turn.turnNumber, turn.currentPlayerId
   * - Each player's money, position, and bankruptcy status (in playerOrder order)
   * - Each tile's ownerId, house count, hotel flag, and mortgage status (sorted by tileId)
   * - bank.houses, bank.hotels, bank.money
   *
   * Fields excluded:
   * - eventLog (cosmetic, append-only)
   * - rngState (changes every dice roll; tracked separately)
   * - checksum itself
   * - lastActionAt (timing metadata)
   *
   * @returns 64-character lowercase hex string.
   */
  static computeChecksum(state: GameState): string {
    const canonical = {
      v: state.version,
      tn: state.turn.turnNumber,
      cp: state.turn.currentPlayerId,
      // Players in canonical turn order — position-dependent
      pm: state.playerOrder.map(id => {
        const p = state.players[id];
        return {
          id,
          money: p?.money ?? 0,
          position: p?.position ?? 0,
          bankrupt: p?.isBankrupt ?? false,
          goojf: p?.getOutOfJailCards ?? 0,
        };
      }),
      pc: state.pendingCard ? {
        id: state.pendingCard.cardId,
        seq: state.pendingCard.drawSequence,
        del: state.pendingCard.removedFromDeck,
      } : null,
      // Tiles sorted by ID for stable ordering regardless of insertion order
      tiles: Object.entries(state.board.tiles)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, t]) => ({
          id,
          owner: t.ownerId,
          h: t.houses,
          ht: t.hasHotel ? 1 : 0,
          m: t.isMortgaged ? 1 : 0,
        })),
      bank: {
        h: state.bank.houses,
        ht: state.bank.hotels,
        // Represent infinite money as a stable sentinel so the checksum
        // doesn't change based on the exact MAX_SAFE_INTEGER representation.
        m: state.bank.money === Number.MAX_SAFE_INTEGER ? '__INF__' : state.bank.money,
        fp: state.bank.freeParkingPot,
      },
    };

    return createHash('sha256')
      .update(JSON.stringify(canonical))
      .digest('hex');
  }

  /**
   * Verify that GameState.checksum matches the recomputed checksum.
   * Used by GameStateService after loading from Redis to detect corruption.
   *
   * @returns true if the state is intact, false if corrupted or tampered.
   */
  static verifyChecksum(state: GameState): boolean {
    try {
      const expected = GameEngine.computeChecksum(state);
      return state.checksum === expected;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Sub-engine Accessors
  // -------------------------------------------------------------------------

  /**
   * Expose the StateMachine for use by server-layer timer workers.
   * (e.g., AuctionTimerWorker needs advanceToNextPlayer after auction ends)
   */
  getStateMachine(): StateMachine {
    return this.stateMachine;
  }

  // -------------------------------------------------------------------------
  // Private Static Helpers
  // -------------------------------------------------------------------------

  /**
   * Build the GameSettings for a new game by merging MapConfig defaults
   * with any provided settingsOverrides.
   */
  private static buildGameSettings(
    mapConfig: MapConfig,
    overrides: Readonly<Partial<GameSettings>> | undefined,
    playerCount: number,
  ): GameSettings {
    const rules = mapConfig.rules;
    const bank = mapConfig.bank;

    return {
      mapId: mapConfig.meta.id,
      maxPlayers: overrides?.maxPlayers ?? playerCount,
      turnTimeSeconds: overrides?.turnTimeSeconds ?? 120,
      auctionDurationSeconds:
        overrides?.auctionDurationSeconds ?? rules.auctionConfig.durationSeconds,
      startingMoney: overrides?.startingMoney ?? bank.startingMoney,
      goReward: overrides?.goReward ?? bank.goReward,
      enableFreeParking: overrides?.enableFreeParking ?? rules.freeParkingMoney,
      enableAuctions: overrides?.enableAuctions ?? rules.auctionOnDecline,
      disconnectedPlayerPolicy:
        overrides?.disconnectedPlayerPolicy ?? DisconnectedPlayerPolicy.SKIP,
      winCondition: overrides?.winCondition ?? rules.winCondition,
      netWorthTarget: overrides?.netWorthTarget ?? rules.netWorthTarget ?? null,
      turnLimit: overrides?.turnLimit ?? rules.turnLimit ?? null,
      isPrivate: overrides?.isPrivate ?? false,
    };
  }

  /**
   * Compute a reasonable initial bank cash amount for finite-money games.
   *
   * Strategy: sum of all purchasable tile prices (properties, railroads, utilities)
   * represents the total "asset pool" the bank holds at game start.
   * A transaction float of (playerCount × startingMoney) is added to cover
   * GO rewards and other bank payments throughout the game.
   *
   * NOTE: Standard Monopoly specifies exact bill denominations, but since MapConfig
   * does not model individual denominations, we use this computed approximation.
   * Override via settingsOverrides if a specific amount is required.
   */
  private static computeInitialBankMoney(
    mapConfig: MapConfig,
    playerCount: number,
    startingMoneyPerPlayer: number,
  ): number {
    const assetPool = mapConfig.board.tiles.reduce((sum, tile) => {
      const price =
        tile.propertyData?.price ??
        tile.railroadData?.price ??
        tile.utilityData?.price ??
        0;
      return sum + price;
    }, 0);

    // Add float: 2× each player's starting money to cover GO rewards, etc.
    return assetPool + playerCount * startingMoneyPerPlayer * 2;
  }

  // -------------------------------------------------------------------------
  // Private Instance Setup
  // -------------------------------------------------------------------------

  private registerCoreRules(): void {
    // TODO: Register core rules when implemented
    // e.g. this.ruleEngine.register(RuleEngine.RULE_PASS_GO, PassGoRule.handler, 10);
    // e.g. this.ruleEngine.register(RuleEngine.RULE_RECOMPUTE_NET_WORTH, NetWorthRule.handler, 200);
  }

  private registerPlugins(plugins: readonly EnginePlugin[]): void {
    for (const plugin of plugins) {
      if (plugin.onTurnEnd) {
        this.ruleEngine.register(`plugin/${plugin.id}/turn-end`, plugin.onTurnEnd, 500);
      }
      // TODO: Inject customValidators into actionProcessor's validator registry
    }
  }
}
