import { CardEffectType } from '@monopoly/shared';
import type { GameState, PlayerId, MapConfig, CardConfig, ClientAction } from '@monopoly/shared';
import type { EngineResult } from './types.js';
import type { TileResolver } from './TileResolver.js';

export type CardEffectExecutor = (
  state: GameState,
  cardConfig: CardConfig,
  playerId: PlayerId,
  mapConfig: MapConfig,
  action: ClientAction,
  tileResolver: TileResolver
) => EngineResult;

/**
 * Registry for mapping card effects (from CardEffectType) to their execution handlers.
 * Also supports mapping custom string IDs to handlers for CardEffectType.CUSTOM.
 */
export class CardEffectRegistry {
  private readonly typeHandlers = new Map<CardEffectType, CardEffectExecutor>();
  private readonly customHandlers = new Map<string, CardEffectExecutor>();

  register(type: CardEffectType, handler: CardEffectExecutor): this {
    this.typeHandlers.set(type, handler);
    return this;
  }

  registerCustom(customHandlerId: string, handler: CardEffectExecutor): this {
    this.customHandlers.set(customHandlerId, handler);
    return this;
  }

  get(type: CardEffectType): CardEffectExecutor | undefined {
    return this.typeHandlers.get(type);
  }

  getCustom(customHandlerId: string): CardEffectExecutor | undefined {
    return this.customHandlers.get(customHandlerId);
  }
}
