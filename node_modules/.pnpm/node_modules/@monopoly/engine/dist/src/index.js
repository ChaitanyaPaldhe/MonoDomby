"use strict";
// =============================================================================
// engine/index.ts
// Barrel export for the game engine.
// Import everything the server layer needs from this single entry point.
//
// Usage:
//   import { GameEngine, StateMachine, DiceEngine, ... } from './engine/index.js';
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapConfigError = exports.EngineTransitionError = exports.EngineStateCorruptionError = exports.EngineNotImplementedError = exports.EngineValidationError = exports.EngineError = exports.TileResolver = exports.BankruptcyEngine = exports.CardEngine = exports.TradeEngine = exports.AuctionEngine = exports.WinDetector = exports.DiceEngine = exports.RuleEngine = exports.ActionProcessor = exports.StateMachine = exports.GameEngine = void 0;
// Core orchestrator — the primary public API
var GameEngine_js_1 = require("./GameEngine.js");
Object.defineProperty(exports, "GameEngine", { enumerable: true, get: function () { return GameEngine_js_1.GameEngine; } });
// Sub-engines (exported for server-layer workers: AuctionTimerWorker, TurnTimerWorker)
var StateMachine_js_1 = require("./StateMachine.js");
Object.defineProperty(exports, "StateMachine", { enumerable: true, get: function () { return StateMachine_js_1.StateMachine; } });
var ActionProcessor_js_1 = require("./ActionProcessor.js");
Object.defineProperty(exports, "ActionProcessor", { enumerable: true, get: function () { return ActionProcessor_js_1.ActionProcessor; } });
var RuleEngine_js_1 = require("./RuleEngine.js");
Object.defineProperty(exports, "RuleEngine", { enumerable: true, get: function () { return RuleEngine_js_1.RuleEngine; } });
var DiceEngine_js_1 = require("./DiceEngine.js");
Object.defineProperty(exports, "DiceEngine", { enumerable: true, get: function () { return DiceEngine_js_1.DiceEngine; } });
var WinDetector_js_1 = require("./WinDetector.js");
Object.defineProperty(exports, "WinDetector", { enumerable: true, get: function () { return WinDetector_js_1.WinDetector; } });
var AuctionEngine_js_1 = require("./AuctionEngine.js");
Object.defineProperty(exports, "AuctionEngine", { enumerable: true, get: function () { return AuctionEngine_js_1.AuctionEngine; } });
var TradeEngine_js_1 = require("./TradeEngine.js");
Object.defineProperty(exports, "TradeEngine", { enumerable: true, get: function () { return TradeEngine_js_1.TradeEngine; } });
var CardEngine_js_1 = require("./CardEngine.js");
Object.defineProperty(exports, "CardEngine", { enumerable: true, get: function () { return CardEngine_js_1.CardEngine; } });
var BankruptcyEngine_js_1 = require("./BankruptcyEngine.js");
Object.defineProperty(exports, "BankruptcyEngine", { enumerable: true, get: function () { return BankruptcyEngine_js_1.BankruptcyEngine; } });
var TileResolver_js_1 = require("./TileResolver.js");
Object.defineProperty(exports, "TileResolver", { enumerable: true, get: function () { return TileResolver_js_1.TileResolver; } });
// Errors
var errors_js_1 = require("./errors.js");
Object.defineProperty(exports, "EngineError", { enumerable: true, get: function () { return errors_js_1.EngineError; } });
Object.defineProperty(exports, "EngineValidationError", { enumerable: true, get: function () { return errors_js_1.EngineValidationError; } });
Object.defineProperty(exports, "EngineNotImplementedError", { enumerable: true, get: function () { return errors_js_1.EngineNotImplementedError; } });
Object.defineProperty(exports, "EngineStateCorruptionError", { enumerable: true, get: function () { return errors_js_1.EngineStateCorruptionError; } });
Object.defineProperty(exports, "EngineTransitionError", { enumerable: true, get: function () { return errors_js_1.EngineTransitionError; } });
Object.defineProperty(exports, "MapConfigError", { enumerable: true, get: function () { return errors_js_1.MapConfigError; } });
//# sourceMappingURL=index.js.map