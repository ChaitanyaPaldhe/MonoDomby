import { CardEffectType } from '@monopoly/shared';
import type { GameState, PlayerId, MapConfig, CardConfig, ClientAction } from '@monopoly/shared';
import type { EngineResult } from './types.js';
import type { TileResolver } from './TileResolver.js';
export type CardEffectExecutor = (state: GameState, cardConfig: CardConfig, playerId: PlayerId, mapConfig: MapConfig, action: ClientAction, tileResolver: TileResolver) => EngineResult;
/**
 * Registry for mapping card effects (from CardEffectType) to their execution handlers.
 * Also supports mapping custom string IDs to handlers for CardEffectType.CUSTOM.
 */
export declare class CardEffectRegistry {
    private readonly typeHandlers;
    private readonly customHandlers;
    register(type: CardEffectType, handler: CardEffectExecutor): this;
    registerCustom(customHandlerId: string, handler: CardEffectExecutor): this;
    get(type: CardEffectType): CardEffectExecutor | undefined;
    getCustom(customHandlerId: string): CardEffectExecutor | undefined;
}
//# sourceMappingURL=CardEffectRegistry.d.ts.map