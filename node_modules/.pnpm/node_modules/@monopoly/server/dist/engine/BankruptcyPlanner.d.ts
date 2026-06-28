import { GameState, MapConfig, PlayerId } from '@monopoly/shared';
export interface BankruptcyPlan {
    readonly playerId: PlayerId;
    readonly creditorId: PlayerId | null;
}
export declare class BankruptcyPlanner {
    static planBankruptcy(state: GameState, config: MapConfig, playerId: PlayerId, actionId: string, clientTs: number): BankruptcyPlan;
}
//# sourceMappingURL=BankruptcyPlanner.d.ts.map