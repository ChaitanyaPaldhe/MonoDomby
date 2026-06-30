;
import { PropertyManagementEngine } from './PropertyManagementEngine.js';
import { MortgagePlanner } from './MortgagePlanner.js';
export class MortgageEngine {
    static applyMortgagePlan(state, plan, config, playerId) {
        // 1. Validation
        MortgagePlanner.validatePlan(plan, state, config, playerId);
        const players = { ...state.players };
        const boardTiles = { ...state.board.tiles };
        // 2. Apply player changes
        const p = players[playerId];
        players[playerId] = { ...p, money: p.money + plan.playerMoneyChange };
        // 3. Apply tile changes
        const ts = boardTiles[plan.tileId];
        boardTiles[plan.tileId] = { ...ts, isMortgaged: plan.isMortgaging };
        // 4. Recalculate net worth for all players (since properties were mortgaged/unmortgaged)
        for (const pId of Object.keys(players)) {
            const player = players[pId];
            const netWorth = PropertyManagementEngine.calculateNetWorth(player.money, player.properties, boardTiles, config);
            players[pId] = { ...player, netWorth };
        }
        const newState = {
            ...state,
            players,
            board: {
                ...state.board,
                tiles: boardTiles
            }
        };
        return { newState, events: plan.events };
    }
}
//# sourceMappingURL=MortgageEngine.js.map