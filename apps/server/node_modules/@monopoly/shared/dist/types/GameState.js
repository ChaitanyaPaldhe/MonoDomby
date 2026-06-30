// =============================================================================
// GameState.ts
// The canonical, authoritative game state shape.
// Designed for JSON serialization (Redis) — uses plain Record<> not Map<>.
// All fields are readonly to enforce immutability at the type level.
// =============================================================================
/** Type-safe cast helpers. Use only at system boundaries (API input, DB read). */
export const PlayerId = (id) => id;
export const TileId = (id) => id;
export const TradeId = (id) => id;
export const AuctionId = (id) => id;
export const RoomId = (id) => id;
export const GameId = (id) => id;
//# sourceMappingURL=GameState.js.map