import type { GameState, PlayerId, MapConfig, CardConfig, ClientAction } from '@monopoly/shared';
import type { EngineResult } from './types.js';
import type { TileResolver } from './TileResolver.js';
export declare function applyCollectFromBank(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult;
export declare function applyPayToBank(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult;
export declare function applyCollectFromPlayers(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult;
export declare function applyPayToPlayers(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult;
export declare function applyMoveToTile(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult;
export declare function applyMoveForward(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult;
export declare function applyMoveBackward(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult;
export declare function applyMoveToNearest(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult;
export declare function applyGoToJail(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult;
export declare function applyGetOutOfJailFree(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult;
export declare function applyRepairs(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult;
//# sourceMappingURL=CardHandlers.d.ts.map