"use strict";
// =============================================================================
// GameState.ts
// The canonical, authoritative game state shape.
// Designed for JSON serialization (Redis) — uses plain Record<> not Map<>.
// All fields are readonly to enforce immutability at the type level.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameId = exports.RoomId = exports.AuctionId = exports.TradeId = exports.TileId = exports.PlayerId = void 0;
/** Type-safe cast helpers. Use only at system boundaries (API input, DB read). */
const PlayerId = (id) => id;
exports.PlayerId = PlayerId;
const TileId = (id) => id;
exports.TileId = TileId;
const TradeId = (id) => id;
exports.TradeId = TradeId;
const AuctionId = (id) => id;
exports.AuctionId = AuctionId;
const RoomId = (id) => id;
exports.RoomId = RoomId;
const GameId = (id) => id;
exports.GameId = GameId;
//# sourceMappingURL=GameState.js.map