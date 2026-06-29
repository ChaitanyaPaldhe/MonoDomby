import { MapConfig } from '@monopoly/maps';
import { GameState, TileId, PlayerId } from '@monopoly/shared';
import type { PropertyTransactionPlan } from './types.js';
export declare class PropertyTransactionPlanner {
    /**
     * Helper to determine if a group's building state is valid (even building).
     * '5' represents a hotel. Difference between max and min buildings cannot exceed 1.
     */
    private static isGroupEven;
    /**
     * General validator for a planned transaction.
     * Ensures bank limits, player cash, and even building rules are respected.
     * Throws EngineValidationError if invalid.
     */
    static validateTransaction(plan: PropertyTransactionPlan, state: GameState, mapConfig: MapConfig, playerId: PlayerId): void;
    /**
     * Check if a player owns all properties in a color group.
     */
    private static ownsMonopoly;
    static planBuildHouse(state: GameState, mapConfig: MapConfig, tileId: TileId, playerId: PlayerId, actionId: string, clientTs: number): PropertyTransactionPlan;
    static planSellHouse(state: GameState, mapConfig: MapConfig, tileId: TileId, playerId: PlayerId, actionId: string, clientTs: number): PropertyTransactionPlan;
    static planBuildHotel(state: GameState, mapConfig: MapConfig, tileId: TileId, playerId: PlayerId, actionId: string, clientTs: number): PropertyTransactionPlan;
    static planSellHotel(state: GameState, mapConfig: MapConfig, tileId: TileId, playerId: PlayerId, actionId: string, clientTs: number): PropertyTransactionPlan;
}
//# sourceMappingURL=PropertyTransactionPlanner.d.ts.map