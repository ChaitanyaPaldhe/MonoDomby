import type { MapConfig } from '@monopoly/maps';
import type { GameState, PlayerId, RNGState, CardDeckState, ClientAction } from '@monopoly/shared';
import type { EngineResult } from './types.js';
import { CardEffectRegistry } from './CardEffectRegistry.js';
import type { TileResolver } from './TileResolver.js';
export declare class CardEngine {
    private readonly registry;
    constructor(customRegistry?: CardEffectRegistry);
    private registerDefaultHandlers;
    buildInitialDecks(mapConfig: MapConfig, rngState: RNGState): [CardDeckState, RNGState];
    /**
     * Executes the drawn card using the registry.
     * This is called when the player sends APPLY_CARD during the CARD_DRAWN phase.
     */
    executeCard(state: GameState, action: ClientAction, mapConfig: MapConfig, actingPlayerId: PlayerId, tileResolver: TileResolver): EngineResult;
    private findCard;
}
//# sourceMappingURL=CardEngine.d.ts.map