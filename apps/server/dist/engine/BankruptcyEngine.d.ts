import { GameState, MapConfig } from '@monopoly/shared';
import { BankruptcyPlan } from './BankruptcyPlanner.js';
export declare class BankruptcyEngine {
    static executeBankruptcyPlan(state: GameState, plan: BankruptcyPlan, config: MapConfig, actionId: string, clientTs: number): {
        newState: GameState;
        events: any[];
    };
}
//# sourceMappingURL=BankruptcyEngine.d.ts.map