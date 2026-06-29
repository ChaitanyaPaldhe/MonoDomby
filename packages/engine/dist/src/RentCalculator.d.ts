import type { MapConfig, Tile } from '@monopoly/maps';
import type { GameState, PlayerId, ClientAction } from '@monopoly/shared';
import type { EngineResult } from './types.js';
/**
 * Encapsulates rent logic for Properties, Railroads, and Utilities.
 */
export declare class RentCalculator {
    /**
     * Calculates and processes rent for a player landing on an owned property.
     *
     * @param state Current game state
     * @param tile The tile landed on (must be PROPERTY, RAILROAD, or UTILITY)
     * @param config Map configuration
     * @param action The originating action (for event IDs)
     * @param actingPlayerId The player who landed and owes rent
     * @returns EngineResult with either rent paid (POST_ROLL) or INSUFFICIENT_FUNDS
     */
    static processRent(state: GameState, tile: Tile, config: MapConfig, action: ClientAction, actingPlayerId: PlayerId): EngineResult;
    private static toPostRoll;
}
//# sourceMappingURL=RentCalculator.d.ts.map