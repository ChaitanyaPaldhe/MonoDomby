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
export { CardEngine } from './CardEngine.js';
export { BankruptcyEngine } from './BankruptcyEngine.js';
export { RentCalculator } from './RentCalculator.js';
export { PropertyTransactionPlanner } from './PropertyTransactionPlanner.js';
export { MortgagePlanner } from './MortgagePlanner.js';
export { BankruptcyPlanner } from './BankruptcyPlanner.js';
export { PropertyManagementEngine } from './PropertyManagementEngine.js';
export { MortgageEngine } from './MortgageEngine.js';
export { AssetTransferEngine } from './AssetTransferEngine.js';
export { DebtResolutionEngine } from './DebtResolutionEngine.js';
export { TileResolver } from './TileResolver.js';
export { CardEffectRegistry } from './CardEffectRegistry.js';
export { canManageProperties } from './utils/PhaseUtils.js';
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
