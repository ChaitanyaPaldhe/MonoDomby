// =============================================================================
// engine/ActionProcessor.ts
// Central action validation and dispatch.
//
// Design:
// - Two registries: validators and handlers, keyed by ActionType.
// - validate() runs the validator — never throws on validation failure.
// - apply() runs the handler — throws EngineNotImplementedError for TODO stubs.
// - actingPlayerId is the JWT-verified player ID passed from SocketData.
//   It is never taken from the action payload.
// =============================================================================

import {
  ActionType,
  ErrorCode,
  GamePhase,
  TurnPhase,
  EventType,
  JailReason,
} from '@monopoly/shared';
import type {
  GameState,
  PlayerState,
  PlayerId,
  TileId,
  JailState,
  TurnState,
} from '@monopoly/shared';
import type { ClientAction } from '@monopoly/shared';
import type { MapConfig } from '@monopoly/shared';
import type {
  DiceRolledEvent,
  PlayerMovedEvent,
  PlayerPassedGoEvent,
  PlayerJailedEvent,
  GameEvent,
} from '@monopoly/shared';
import type {
  ValidationResult,
  Validator,
  ActionHandler,
  EngineResult,
} from './types.js';
import { EngineValidationError, EngineNotImplementedError, EngineStateCorruptionError } from './errors.js';
import { TileResolver } from './TileResolver.js';
import type { CustomTileHandlerFn } from './TileResolver.js';
import { DiceEngine } from './DiceEngine.js';
import type { DiceRollResult } from './DiceEngine.js';
import { StateMachine } from './StateMachine.js';

// ---------------------------------------------------------------------------
// Internal helper types
// ---------------------------------------------------------------------------

type InternalValidator = (
  state: GameState,
  action: ClientAction,
  mapConfig: MapConfig,
  actingPlayerId: PlayerId,
) => ValidationResult;

type InternalHandler = (
  state: GameState,
  action: ClientAction,
  mapConfig: MapConfig,
  actingPlayerId: PlayerId,
) => EngineResult;

// ---------------------------------------------------------------------------
// ActionProcessor
// ---------------------------------------------------------------------------

/**
 * Validates and dispatches client actions to their handler functions.
 *
 * Pipeline position: receives action AFTER auth middleware, BEFORE state persistence.
 * Does NOT read from Redis; receives the already-loaded GameState as a parameter.
 *
 * ### Auth contract
 * `actingPlayerId` is provided by the server's Socket.IO middleware, extracted
 * from the verified JWT. It is NEVER derived from the action payload.
 */
export class ActionProcessor {
  private readonly validators = new Map<ActionType, InternalValidator>();
  private readonly handlers = new Map<ActionType, InternalHandler>();
  private readonly tileResolver: TileResolver;

  /**
   * @param stateMachine       Shared StateMachine instance from GameEngine.
   * @param customTileHandlers Optional map of tile-ID → handler for CUSTOM tiles.
   *                           Pass at game-start if the map has CUSTOM tile types.
   */
  constructor(
    private readonly stateMachine: StateMachine,
    customTileHandlers?: ReadonlyMap<string, CustomTileHandlerFn>,
  ) {
    this.tileResolver = new TileResolver(customTileHandlers);
    this.registerValidators();
    this.registerHandlers();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Validate an action against the current state.
   * Returns ValidationResult — does NOT throw on validation failure.
   *
   * @param state        Current authoritative game state.
   * @param action       Client-submitted action.
   * @param mapConfig    Loaded map configuration for this game.
   * @param actingPlayerId JWT-verified player performing this action.
   */
  validate(
    state: GameState,
    action: ClientAction,
    mapConfig: MapConfig,
    actingPlayerId: PlayerId,
  ): ValidationResult {
    const validator = this.validators.get(action.type);
    if (!validator) {
      return {
        valid: false,
        reason: `No validator registered for action type '${action.type}'.`,
        code: ErrorCode.E_UNKNOWN,
      };
    }
    try {
      return validator(state, action, mapConfig, actingPlayerId);
    } catch (err) {
      if (err instanceof EngineValidationError) {
        return { valid: false, reason: err.message, code: err.code };
      }
      throw err;
    }
  }

  /**
   * Apply a previously validated action to the state.
   * Returns the new state and emitted events.
   *
   * IMPORTANT: Only call this AFTER validate() returns { valid: true }.
   * @throws {EngineNotImplementedError} for TODO stub handlers.
   * @throws {EngineValidationError} if a handler detects a late-breaking conflict.
   */
  apply(
    state: GameState,
    action: ClientAction,
    mapConfig: MapConfig,
    actingPlayerId: PlayerId,
  ): EngineResult {
    const handler = this.handlers.get(action.type);
    if (!handler) {
      throw new Error(`[ACTION_PROCESSOR] No handler registered for '${action.type}'.`);
    }
    return handler(state, action, mapConfig, actingPlayerId);
  }

  // -------------------------------------------------------------------------
  // Validator Registration
  // -------------------------------------------------------------------------

  private registerValidators(): void {
    // Lobby
    this.validators.set(ActionType.ROOM_READY, this.validateRoomReady.bind(this));
    this.validators.set(ActionType.ROOM_SETTINGS_UPDATE, this.validateRoomSettingsUpdate.bind(this));
    this.validators.set(ActionType.ROOM_START_GAME, this.validateRoomStartGame.bind(this));

    // Turn core
    this.validators.set(ActionType.ROLL_DICE, this.validateRollDice.bind(this));
    this.validators.set(ActionType.BUY_PROPERTY, this.validateBuyProperty.bind(this));
    this.validators.set(ActionType.DECLINE_PROPERTY, this.validateDeclineProperty.bind(this));
    this.validators.set(ActionType.END_TURN, this.validateEndTurn.bind(this));

    // Jail
    this.validators.set(ActionType.PAY_JAIL_FINE, this.validatePayJailFine.bind(this));
    this.validators.set(ActionType.USE_JAIL_CARD, this.validateUseJailCard.bind(this));
    this.validators.set(ActionType.ROLL_FOR_DOUBLES, this.validateRollForDoubles.bind(this));

    // Property management
    this.validators.set(ActionType.BUILD_HOUSE, this.validateBuildHouse.bind(this));
    this.validators.set(ActionType.BUILD_HOTEL, this.validateBuildHotel.bind(this));
    this.validators.set(ActionType.SELL_HOUSE, this.validateSellHouse.bind(this));
    this.validators.set(ActionType.SELL_HOTEL, this.validateSellHotel.bind(this));
    this.validators.set(ActionType.MORTGAGE_PROPERTY, this.validateMortgageProperty.bind(this));
    this.validators.set(ActionType.UNMORTGAGE_PROPERTY, this.validateUnmortgageProperty.bind(this));

    // Trade
    this.validators.set(ActionType.TRADE_PROPOSE, this.validateTradePropose.bind(this));
    this.validators.set(ActionType.TRADE_ACCEPT, this.validateTradeAccept.bind(this));
    this.validators.set(ActionType.TRADE_REJECT, this.validateTradeReject.bind(this));
    this.validators.set(ActionType.TRADE_COUNTER, this.validateTradeCounter.bind(this));
    this.validators.set(ActionType.TRADE_CANCEL, this.validateTradeCancel.bind(this));

    // System
    this.validators.set(ActionType.REQUEST_FULL_STATE, this.validateRequestFullState.bind(this));
  }

  // -------------------------------------------------------------------------
  // Handler Registration
  // -------------------------------------------------------------------------

  private registerHandlers(): void {
    // Lobby
    this.handlers.set(ActionType.ROOM_READY, this.handleRoomReady.bind(this));
    this.handlers.set(ActionType.ROOM_SETTINGS_UPDATE, this.handleRoomSettingsUpdate.bind(this));
    this.handlers.set(ActionType.ROOM_START_GAME, this.handleRoomStartGame.bind(this));

    // Turn core
    this.handlers.set(ActionType.ROLL_DICE, this.handleRollDice.bind(this));
    this.handlers.set(ActionType.BUY_PROPERTY, this.handleBuyProperty.bind(this));
    this.handlers.set(ActionType.DECLINE_PROPERTY, this.handleDeclineProperty.bind(this));
    this.handlers.set(ActionType.END_TURN, this.handleEndTurn.bind(this));

    // Jail
    this.handlers.set(ActionType.PAY_JAIL_FINE, this.handlePayJailFine.bind(this));
    this.handlers.set(ActionType.USE_JAIL_CARD, this.handleUseJailCard.bind(this));
    this.handlers.set(ActionType.ROLL_FOR_DOUBLES, this.handleRollForDoubles.bind(this));

    // Property management
    this.handlers.set(ActionType.BUILD_HOUSE, this.handleBuildHouse.bind(this));
    this.handlers.set(ActionType.BUILD_HOTEL, this.handleBuildHotel.bind(this));
    this.handlers.set(ActionType.SELL_HOUSE, this.handleSellHouse.bind(this));
    this.handlers.set(ActionType.SELL_HOTEL, this.handleSellHotel.bind(this));
    this.handlers.set(ActionType.MORTGAGE_PROPERTY, this.handleMortgageProperty.bind(this));
    this.handlers.set(ActionType.UNMORTGAGE_PROPERTY, this.handleUnmortgageProperty.bind(this));

    // Trade
    this.handlers.set(ActionType.TRADE_PROPOSE, this.handleTradePropose.bind(this));
    this.handlers.set(ActionType.TRADE_ACCEPT, this.handleTradeAccept.bind(this));
    this.handlers.set(ActionType.TRADE_REJECT, this.handleTradeReject.bind(this));
    this.handlers.set(ActionType.TRADE_COUNTER, this.handleTradeCounter.bind(this));
    this.handlers.set(ActionType.TRADE_CANCEL, this.handleTradeCancel.bind(this));

    // System
    this.handlers.set(ActionType.REQUEST_FULL_STATE, this.handleRequestFullState.bind(this));
  }

  // =========================================================================
  //  ROLL_DICE — Fully Implemented
  // =========================================================================

  private validateRollDice(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    actingPlayerId: PlayerId,
  ): ValidationResult {
    if (state.phase !== GamePhase.IN_PROGRESS) {
      return fail(ErrorCode.E_GAME_NOT_STARTED, 'Game is not in progress.');
    }
    if (state.turn.currentPlayerId !== actingPlayerId) {
      return fail(
        ErrorCode.E_NOT_YOUR_TURN,
        `It is not your turn. Current player: '${state.turn.currentPlayerId}'.`,
      );
    }
    if (state.turn.phase !== TurnPhase.PRE_ROLL) {
      return fail(
        ErrorCode.E_INVALID_PHASE,
        `Cannot roll dice in turn phase '${state.turn.phase}'. Expected PRE_ROLL.`,
      );
    }
    return ok();
  }

  /**
   * Roll the dice, move the player, and handle all movement effects.
   *
   * Pipeline:
   *  1. Roll two dice using the PRNG — advances rngState deterministically.
   *  2. Track consecutive doubles. On the 3rd: jail the player and exit early.
   *  3. Compute new position (position + total) % board.size.
   *  4. Detect passing GO — award salary exactly once.
   *  5. Move the player.
   *  6. Advance TurnPhase to ROLLED.
   *  7. Delegate to resolveLandingTile() (stub → POST_ROLL).
   *  8. Return { newState, events }.
   *
   * Event order (normal): DICE_ROLLED → [PLAYER_PASSED_GO] → PLAYER_MOVED.
   * Event order (jail):   DICE_ROLLED → PLAYER_JAILED.
   */
  private handleRollDice(
    state: GameState,
    action: ClientAction,
    config: MapConfig,
    actingPlayerId: PlayerId,
  ): EngineResult {
    const player = state.players[actingPlayerId];
    if (!player) {
      throw new EngineStateCorruptionError(
        `handleRollDice: player '${actingPlayerId}' not found in state.players`,
      );
    }

    // ------------------------------------------------------------------
    // 1. Roll dice
    // ------------------------------------------------------------------
    const rollResult: DiceRollResult = DiceEngine.rollTwoDice(state.rngState);
    const { dice, total, isDoubles, nextRngState } = rollResult;
    const newConsecutiveDoubles = isDoubles ? state.turn.consecutiveDoubles + 1 : 0;

    const diceRolledEvent = ActionProcessor.buildDiceRolledEvent(
      state, action, actingPlayerId, dice, isDoubles, newConsecutiveDoubles,
    );

    // ------------------------------------------------------------------
    // 2. Three consecutive doubles → jail immediately
    // ------------------------------------------------------------------
    if (newConsecutiveDoubles >= 3) {
      return this.handleJailByTripleDoubles(
        state, action, config, actingPlayerId,
        dice, nextRngState, diceRolledEvent,
      );
    }

    // ------------------------------------------------------------------
    // 3. Compute movement
    // ------------------------------------------------------------------
    const boardSize = config.board.size;
    const fromPosition = player.position;
    const rawNewPosition = fromPosition + total;
    const passedGo = rawNewPosition >= boardSize;
    const toPosition = rawNewPosition % boardSize;

    // Animation path: every tile index passed through (including landing tile)
    const pathTaken: number[] = [];
    for (let step = 1; step <= total; step++) {
      pathTaken.push((fromPosition + step) % boardSize);
    }

    // ------------------------------------------------------------------
    // 4. Build intermediate state: advance RNG, set ROLLED phase
    // ------------------------------------------------------------------
    let currentState: GameState = {
      ...state,
      rngState: nextRngState,
      lastActionAt: action.clientTs,
      turn: {
        ...state.turn,
        phase: TurnPhase.ROLLED,
        diceValues: dice,
        isDoubles,
        consecutiveDoubles: newConsecutiveDoubles,
        pendingDecision: null,
      },
    };

    const events: GameEvent[] = [diceRolledEvent];

    // ------------------------------------------------------------------
    // 5. Award GO salary (exactly once, even when landing exactly on GO)
    // ------------------------------------------------------------------
    if (passedGo) {
      const goReward = currentState.settings.goReward;
      const p = currentState.players[actingPlayerId]!;
      currentState = {
        ...currentState,
        players: {
          ...currentState.players,
          [actingPlayerId]: {
            ...p,
            money: p.money + goReward,
            netWorth: p.netWorth + goReward,
          },
        },
        bank: {
          ...currentState.bank,
          // Infinite-money banks stay at MAX_SAFE_INTEGER; finite banks debit
          money: currentState.bank.money === Number.MAX_SAFE_INTEGER
            ? Number.MAX_SAFE_INTEGER
            : currentState.bank.money - goReward,
        },
      };
      events.push(
        ActionProcessor.buildPlayerPassedGoEvent(state, action, actingPlayerId, goReward),
      );
    }

    // ------------------------------------------------------------------
    // 6. Move player
    // ------------------------------------------------------------------
    const playerAfterGo = currentState.players[actingPlayerId]!;
    currentState = {
      ...currentState,
      players: {
        ...currentState.players,
        [actingPlayerId]: {
          ...playerAfterGo,
          position: toPosition,
        },
      },
    };

    events.push(
      ActionProcessor.buildPlayerMovedEvent(
        state, action, actingPlayerId, fromPosition, toPosition, pathTaken, passedGo,
      ),
    );

    // ------------------------------------------------------------------
    // 7. Resolve the landing tile — full TileResolver dispatch
    // ------------------------------------------------------------------
    const landing = this.resolveLandingTile(
      currentState, config, toPosition, action, actingPlayerId,
    );

    return {
      // Exactly one version increment per action, applied here
      newState: { ...landing.newState, version: state.version + 1 },
      events: [...events, ...landing.events],
    };
  }

  /**
   * Handle the third consecutive doubles: send the player to jail immediately
   * without resolving any landing tile.
   *
   * State changes:
   *  - player.position = jailTileIndex
   *  - player.jailState set with reason THREE_DOUBLES
   *  - turn.phase = POST_ROLL (turn is over, player must END_TURN)
   *  - turn.isDoubles = false (go-again bonus forfeited)
   *  - turn.consecutiveDoubles = 0 (reset)
   *
   * Events emitted: DICE_ROLLED, PLAYER_JAILED.
   */
  private handleJailByTripleDoubles(
    state: GameState,
    action: ClientAction,
    config: MapConfig,
    actingPlayerId: PlayerId,
    dice: readonly [number, number],
    nextRngState: import('@monopoly/shared').RNGState,
    diceRolledEvent: GameEvent,
  ): EngineResult {
    const jailTileIndex = config.board.jailTileIndex;
    const player = state.players[actingPlayerId]!;

    const newJailState: JailState = {
      reason: JailReason.THREE_DOUBLES,
      turnsServed: 0,
      jailedAt: action.clientTs,
    };

    const newState: GameState = {
      ...state,
      rngState: nextRngState,
      lastActionAt: action.clientTs,
      version: state.version + 1,
      players: {
        ...state.players,
        [actingPlayerId]: {
          ...player,
          position: jailTileIndex,
          jailState: newJailState,
        },
      },
      turn: {
        ...state.turn,
        phase: TurnPhase.POST_ROLL,
        diceValues: dice,
        // The doubles bonus is forfeited when going to jail
        isDoubles: false,
        consecutiveDoubles: 0,
        pendingDecision: null,
      },
    };

    const jailedEvent = ActionProcessor.buildPlayerJailedEvent(
      state, action, actingPlayerId, JailReason.THREE_DOUBLES,
    );

    return {
      newState,
      events: [diceRolledEvent, jailedEvent],
    };
  }

  /**
   * Resolve the effects of the player landing on a tile.
   *
   * Delegates entirely to TileResolver which dispatches on TileType.
   * Every supported tile type is handled; an exhaustive TypeScript switch
   * in TileResolver will fail at compile time if a new TileType is added
   * without a corresponding case.
   *
   * @param state          State after movement (player at new position, ROLLED phase).
   * @param config         Map configuration.
   * @param tileIndex      Zero-based board index of the tile landed on.
   * @param action         The originating ROLL_DICE action.
   * @param actingPlayerId JWT-verified acting player.
   */
  private resolveLandingTile(
    state: GameState,
    config: MapConfig,
    tileIndex: number,
    action: ClientAction,
    actingPlayerId: PlayerId,
  ): EngineResult {
    return this.tileResolver.resolve(state, tileIndex, config, action, actingPlayerId);
  }

  // =========================================================================
  //  ROOM actions — stubs
  // =========================================================================

  private validateRoomReady(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): ValidationResult {
    // TODO: Validate player is in lobby, not already marked ready
    return ok();
  }

  private handleRoomReady(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    throw new EngineNotImplementedError('ActionProcessor.handleRoomReady');
  }

  private validateRoomSettingsUpdate(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): ValidationResult {
    // TODO: Validate player is room host, game not started
    return ok();
  }

  private handleRoomSettingsUpdate(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    throw new EngineNotImplementedError('ActionProcessor.handleRoomSettingsUpdate');
  }

  private validateRoomStartGame(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): ValidationResult {
    // TODO: Validate player is host, all players ready, 2–8 players
    return ok();
  }

  private handleRoomStartGame(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    throw new EngineNotImplementedError('ActionProcessor.handleRoomStartGame');
  }

  // =========================================================================
  //  BUY_PROPERTY — stub
  // =========================================================================

  private validateBuyProperty(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    actingPlayerId: PlayerId,
  ): ValidationResult {
    const base = this.baseGameplayValidation(state, actingPlayerId);
    if (!base.valid) return base;
    // TODO: Validate pending decision is PURCHASE, player has funds
    return ok();
  }

  private handleBuyProperty(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    throw new EngineNotImplementedError('ActionProcessor.handleBuyProperty');
  }

  // =========================================================================
  //  DECLINE_PROPERTY — stub
  // =========================================================================

  private validateDeclineProperty(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    actingPlayerId: PlayerId,
  ): ValidationResult {
    const base = this.baseGameplayValidation(state, actingPlayerId);
    if (!base.valid) return base;
    // TODO: Validate pending decision is PURCHASE
    return ok();
  }

  private handleDeclineProperty(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    throw new EngineNotImplementedError('ActionProcessor.handleDeclineProperty');
  }

  // =========================================================================
  //  END_TURN — stub
  // =========================================================================

  private validateEndTurn(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    actingPlayerId: PlayerId,
  ): ValidationResult {
    const base = this.baseGameplayValidation(state, actingPlayerId);
    if (!base.valid) return base;
    if (state.turn.phase !== TurnPhase.POST_ROLL) {
      return fail(
        ErrorCode.E_INVALID_PHASE,
        `Cannot end turn in phase '${state.turn.phase}'. Expected POST_ROLL.`,
      );
    }
    return ok();
  }

  private handleEndTurn(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    // TODO: Implement:
    // 1. If state.turn.isDoubles → call StateMachine.resetTurnForDoubles()
    // 2. Otherwise → call StateMachine.advanceToNextPlayer()
    // 3. Emit TURN_ENDED event.
    throw new EngineNotImplementedError('ActionProcessor.handleEndTurn');
  }

  // =========================================================================
  //  JAIL actions — stubs
  // =========================================================================

  private validatePayJailFine(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    actingPlayerId: PlayerId,
  ): ValidationResult {
    const base = this.baseGameplayValidation(state, actingPlayerId);
    if (!base.valid) return base;
    // TODO: Validate player is in jail, has sufficient funds
    return ok();
  }

  private handlePayJailFine(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    throw new EngineNotImplementedError('ActionProcessor.handlePayJailFine');
  }

  private validateUseJailCard(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    actingPlayerId: PlayerId,
  ): ValidationResult {
    const base = this.baseGameplayValidation(state, actingPlayerId);
    if (!base.valid) return base;
    // TODO: Validate player is in jail, holds at least 1 GOOJF card
    return ok();
  }

  private handleUseJailCard(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    throw new EngineNotImplementedError('ActionProcessor.handleUseJailCard');
  }

  private validateRollForDoubles(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    actingPlayerId: PlayerId,
  ): ValidationResult {
    const base = this.baseGameplayValidation(state, actingPlayerId);
    if (!base.valid) return base;
    // TODO: Validate player is in jail, phase is JAIL_DECISION
    return ok();
  }

  private handleRollForDoubles(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    throw new EngineNotImplementedError('ActionProcessor.handleRollForDoubles');
  }

  // =========================================================================
  //  PROPERTY MANAGEMENT actions — stubs
  // =========================================================================

  private validateBuildHouse(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    actingPlayerId: PlayerId,
  ): ValidationResult {
    const base = this.baseGameplayValidation(state, actingPlayerId);
    if (!base.valid) return base;
    // TODO: Validate POST_ROLL phase, color group monopoly, even build rule, bank supply
    return ok();
  }

  private handleBuildHouse(
    _state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    throw new EngineNotImplementedError('ActionProcessor.handleBuildHouse');
  }

  private validateBuildHotel(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    actingPlayerId: PlayerId,
  ): ValidationResult {
    const base = this.baseGameplayValidation(state, actingPlayerId);
    if (!base.valid) return base;
    // TODO: Validate POST_ROLL phase, 4 houses present, bank supply
    return ok();
  }

  private handleBuildHotel(
    _state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    throw new EngineNotImplementedError('ActionProcessor.handleBuildHotel');
  }

  private validateSellHouse(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    actingPlayerId: PlayerId,
  ): ValidationResult {
    const base = this.baseGameplayValidation(state, actingPlayerId);
    if (!base.valid) return base;
    // TODO: Validate POST_ROLL phase, player owns house, even-build rule
    return ok();
  }

  private handleSellHouse(
    _state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    throw new EngineNotImplementedError('ActionProcessor.handleSellHouse');
  }

  private validateSellHotel(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    actingPlayerId: PlayerId,
  ): ValidationResult {
    const base = this.baseGameplayValidation(state, actingPlayerId);
    if (!base.valid) return base;
    return ok();
  }

  private handleSellHotel(
    _state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    throw new EngineNotImplementedError('ActionProcessor.handleSellHotel');
  }

  private validateMortgageProperty(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    actingPlayerId: PlayerId,
  ): ValidationResult {
    const base = this.baseGameplayValidation(state, actingPlayerId);
    if (!base.valid) return base;
    // TODO: Validate POST_ROLL phase, player owns unmortgaged property, no buildings
    return ok();
  }

  private handleMortgageProperty(
    _state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    throw new EngineNotImplementedError('ActionProcessor.handleMortgageProperty');
  }

  private validateUnmortgageProperty(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    actingPlayerId: PlayerId,
  ): ValidationResult {
    const base = this.baseGameplayValidation(state, actingPlayerId);
    if (!base.valid) return base;
    // TODO: Validate POST_ROLL phase, player owns mortgaged property, has funds
    return ok();
  }

  private handleUnmortgageProperty(
    _state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    throw new EngineNotImplementedError('ActionProcessor.handleUnmortgageProperty');
  }

  // =========================================================================
  //  TRADE actions — stubs
  // =========================================================================

  private validateTradePropose(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): ValidationResult {
    // TODO: Validate POST_ROLL phase, valid target, no duplicate active trade
    return ok();
  }

  private handleTradePropose(
    _state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    // TODO: Delegate to TradeEngine.proposeTrade()
    throw new EngineNotImplementedError('ActionProcessor.handleTradePropose');
  }

  private validateTradeAccept(
    _state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): ValidationResult {
    // TODO: Validate trade exists, acting player is the target, trade is PENDING
    return ok();
  }

  private handleTradeAccept(
    _state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    // TODO: Delegate to TradeEngine.acceptTrade()
    throw new EngineNotImplementedError('ActionProcessor.handleTradeAccept');
  }

  private validateTradeReject(
    _state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): ValidationResult {
    // TODO: Validate trade exists, acting player is the target
    return ok();
  }

  private handleTradeReject(
    _state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    // TODO: Delegate to TradeEngine.rejectTrade()
    throw new EngineNotImplementedError('ActionProcessor.handleTradeReject');
  }

  private validateTradeCounter(
    _state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): ValidationResult {
    // TODO: Validate trade exists, acting player is the target, trade is PENDING
    return ok();
  }

  private handleTradeCounter(
    _state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    // TODO: Delegate to TradeEngine.counterTrade()
    throw new EngineNotImplementedError('ActionProcessor.handleTradeCounter');
  }

  private validateTradeCancel(
    _state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): ValidationResult {
    // TODO: Validate trade exists, acting player is the initiator
    return ok();
  }

  private handleTradeCancel(
    _state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    // TODO: Delegate to TradeEngine.cancelTrade()
    throw new EngineNotImplementedError('ActionProcessor.handleTradeCancel');
  }

  // =========================================================================
  //  SYSTEM actions
  // =========================================================================

  private validateRequestFullState(
    _state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): ValidationResult {
    // REQUEST_FULL_STATE is always valid (used for reconnection)
    return ok();
  }

  private handleRequestFullState(
    state: GameState,
    _action: ClientAction,
    _config: MapConfig,
    _actingPlayerId: PlayerId,
  ): EngineResult {
    // Return current state with no events. The server layer will
    // serialize and send the full state snapshot to the requesting player.
    return { newState: state, events: [] };
  }

  // =========================================================================
  //  Shared Validation Helpers
  // =========================================================================

  /**
   * Common gameplay guard: game must be in progress AND it must be this player's turn.
   */
  private baseGameplayValidation(
    state: GameState,
    actingPlayerId: PlayerId,
  ): ValidationResult {
    if (state.phase !== GamePhase.IN_PROGRESS) {
      return fail(ErrorCode.E_GAME_NOT_STARTED, 'Game is not in progress.');
    }
    if (state.turn.currentPlayerId !== actingPlayerId) {
      return fail(
        ErrorCode.E_NOT_YOUR_TURN,
        `It is not your turn. Current player: '${state.turn.currentPlayerId}'.`,
      );
    }
    return ok();
  }

  // =========================================================================
  //  Event Builders (private static helpers)
  // =========================================================================

  /**
   * Build a DICE_ROLLED event.
   * Event ID is derived from action.actionId to ensure determinism.
   */
  private static buildDiceRolledEvent(
    state: GameState,
    action: ClientAction,
    playerId: PlayerId,
    dice: readonly [number, number],
    isDoubles: boolean,
    consecutiveDoubles: number,
  ): DiceRolledEvent {
    return {
      id: `${action.actionId}::DICE_ROLLED`,
      type: EventType.DICE_ROLLED,
      roomId: state.roomId as unknown as string,
      gameId: state.id as unknown as string,
      ts: action.clientTs,
      audience: { type: 'ALL' },
      payload: {
        playerId,
        dice,
        total: dice[0] + dice[1],
        isDoubles,
        consecutiveDoubles,
      },
    };
  }

  /** Build a PLAYER_PASSED_GO event (awarded GO salary). */
  private static buildPlayerPassedGoEvent(
    state: GameState,
    action: ClientAction,
    playerId: PlayerId,
    amount: number,
  ): PlayerPassedGoEvent {
    return {
      id: `${action.actionId}::PLAYER_PASSED_GO`,
      type: EventType.PLAYER_PASSED_GO,
      roomId: state.roomId as unknown as string,
      gameId: state.id as unknown as string,
      ts: action.clientTs,
      audience: { type: 'ALL' },
      payload: { playerId, amount },
    };
  }

  /** Build a PLAYER_MOVED event. */
  private static buildPlayerMovedEvent(
    state: GameState,
    action: ClientAction,
    playerId: PlayerId,
    fromPosition: number,
    toPosition: number,
    pathTaken: readonly number[],
    passedGo: boolean,
  ): PlayerMovedEvent {
    return {
      id: `${action.actionId}::PLAYER_MOVED`,
      type: EventType.PLAYER_MOVED,
      roomId: state.roomId as unknown as string,
      gameId: state.id as unknown as string,
      ts: action.clientTs,
      audience: { type: 'ALL' },
      payload: { playerId, fromPosition, toPosition, pathTaken, passedGo },
    };
  }

  /** Build a PLAYER_JAILED event. */
  private static buildPlayerJailedEvent(
    state: GameState,
    action: ClientAction,
    playerId: PlayerId,
    reason: JailReason,
  ): PlayerJailedEvent {
    return {
      id: `${action.actionId}::PLAYER_JAILED`,
      type: EventType.PLAYER_JAILED,
      roomId: state.roomId as unknown as string,
      gameId: state.id as unknown as string,
      ts: action.clientTs,
      audience: { type: 'ALL' },
      payload: { playerId, reason },
    };
  }
}

// ---------------------------------------------------------------------------
// Standalone Helpers (module-level, not class members)
// ---------------------------------------------------------------------------

function ok(): ValidationResult {
  return { valid: true };
}

function fail(code: ErrorCode, reason: string): ValidationResult {
  return { valid: false, code, reason };
}
