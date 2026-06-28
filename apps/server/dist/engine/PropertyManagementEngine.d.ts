import { GameState, MapConfig, PlayerId } from '@monopoly/shared';
import type { PropertyTransactionPlan } from './types.js';
export declare class PropertyManagementEngine {
    /**
     * Calculates the net worth of a player:
     * Cash + Mortgage value of all unmortgaged properties
     * + (Cost per house / 2) for all houses/hotels.
     */
    static calculateNetWorth(playerMoney: number, playerProperties: readonly string[], boardTiles: Record<string, import('@monopoly/shared').TileState>, mapConfig: MapConfig): number;
    static applyTransaction(state: GameState, plan: PropertyTransactionPlan, mapConfig: MapConfig, playerId: PlayerId): {
        newState: GameState;
        events: readonly import('@monopoly/shared').GameEvent[];
    };
}
//# sourceMappingURL=PropertyManagementEngine.d.ts.map