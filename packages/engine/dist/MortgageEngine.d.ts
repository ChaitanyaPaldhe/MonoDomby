import { MapConfig } from '@monopoly/maps';
import { GameState, PlayerId } from '@monopoly/shared';
import type { MortgagePlan } from './types.js';
export declare class MortgageEngine {
    static applyMortgagePlan(state: GameState, plan: MortgagePlan, config: MapConfig, playerId: PlayerId): {
        newState: GameState;
        events: readonly import('@monopoly/shared').GameEvent[];
    };
}
//# sourceMappingURL=MortgageEngine.d.ts.map