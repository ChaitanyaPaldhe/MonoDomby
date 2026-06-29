import { MapConfig } from '@monopoly/maps';
import { GameState, PlayerId, TileId } from '@monopoly/shared';
import type { MortgagePlan } from './types.js';
export declare class MortgagePlanner {
    static planMortgageProperty(state: GameState, config: MapConfig, tileId: TileId, playerId: PlayerId, actionId: string, clientTs: number): MortgagePlan;
    static planUnmortgageProperty(state: GameState, config: MapConfig, tileId: TileId, playerId: PlayerId, actionId: string, clientTs: number): MortgagePlan;
    static validatePlan(plan: MortgagePlan, state: GameState, config: MapConfig, playerId: PlayerId): void;
}
//# sourceMappingURL=MortgagePlanner.d.ts.map