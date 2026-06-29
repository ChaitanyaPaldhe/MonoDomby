import { GameState } from '@monopoly/shared';
export declare class TradeValidator {
    /**
     * Validates if any trade action is allowed at the current moment.
     * Checks phase requirements (no auction, no debt recovery, no cards pending).
     */
    static validateCanTrade(state: GameState): void;
}
//# sourceMappingURL=TradeValidator.d.ts.map