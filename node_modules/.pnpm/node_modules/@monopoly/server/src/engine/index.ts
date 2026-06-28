// =============================================================================
// engine/index.ts
// Barrel export for the game engine.
// Import everything the server layer needs from this single entry point.
//
// Usage:
//   import { GameEngine, StateMachine, DiceEngine, ... } from './engine/index.js';
// =============================================================================

// Core orchestrator — the primary public API
export { GameEngine } from './GameEngine.js';

// Sub-engines (exported for server-layer workers: AuctionTimerWorker, TurnTimerWorker)
export { StateMachine } from './StateMachine.js';
export { ActionProcessor } from './ActionProcessor.js';
export { RuleEngine } from './RuleEngine.js';
export { DiceEngine } from './DiceEngine.js';
export { WinDetector } from './WinDetector.js';
export { AuctionEngine } from './AuctionEngine.js';
export { TradeEngine } from './TradeEngine.js';
export { CardEngine, CardHandlerRegistry } from './CardEngine.js';
export { BankruptcyEngine } from './BankruptcyEngine.js';
export { TileResolver } from './TileResolver.js';
export type { CustomTileHandlerFn } from './TileResolver.js';

// Types
export type {
  EngineResult,
  ValidationResult,
  Validator,
  ActionHandler,
  RuleContext,
  RuleHandler,
  RegisteredRule,
  CardHandler,
  WinCheckResult,
  EnginePlugin,
  CreateGameParams,
} from './types.js';

// Errors
export {
  EngineError,
  EngineValidationError,
  EngineNotImplementedError,
  EngineStateCorruptionError,
  EngineTransitionError,
  MapConfigError,
} from './errors.js';

// DiceRollResult (needed by server layer to update state after timer-triggered rolls)
export type { DiceRollResult } from './DiceEngine.js';
