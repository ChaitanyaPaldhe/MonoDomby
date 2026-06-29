import { MapConfig } from '@monopoly/maps';
import { GameState, PlayerId, TileId } from '@monopoly/shared';
export declare class AssetTransferEngine {
    /**
     * Transfers a single property from one player to another.
     * If `toPlayerId` is null, the property is returned to the bank (unowned).
     * Does NOT emit events. Returns the new state and the tileId transferred.
     */
    static transferProperty(state: GameState, fromPlayerId: PlayerId, toPlayerId: PlayerId | null, tileId: TileId): GameState;
    /**
     * Transfers all properties and GOOJF cards from one player to another (or bank).
     * Generates appropriate events.
     */
    static transferAllAssets(state: GameState, fromPlayerId: PlayerId, toPlayerId: PlayerId | null, actionId: string, clientTs: number, config: MapConfig): {
        newState: GameState;
        events: any[];
    };
}
//# sourceMappingURL=AssetTransferEngine.d.ts.map