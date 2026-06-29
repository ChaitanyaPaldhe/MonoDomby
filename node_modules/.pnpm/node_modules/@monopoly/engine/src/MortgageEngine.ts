import { MapConfig } from '@monopoly/maps';
import { GameState, PlayerId } from '@monopoly/shared';;
import type { MortgagePlan } from './types.js';
import { PropertyManagementEngine } from './PropertyManagementEngine.js';
import { MortgagePlanner } from './MortgagePlanner.js';

export class MortgageEngine {
  public static applyMortgagePlan(
    state: GameState,
    plan: MortgagePlan,
    config: MapConfig,
    playerId: PlayerId
  ): { newState: GameState; events: readonly import('@monopoly/shared').GameEvent[] } {
    // 1. Validation
    MortgagePlanner.validatePlan(plan, state, config, playerId);

    const players = { ...state.players };
    const boardTiles = { ...state.board.tiles };
    
    // 2. Apply player changes
    const p = players[playerId]!;
    players[playerId] = { ...p, money: p.money + plan.playerMoneyChange };

    // 3. Apply tile changes
    const ts = boardTiles[plan.tileId]!;
    boardTiles[plan.tileId] = { ...ts, isMortgaged: plan.isMortgaging };

    // 4. Recalculate net worth for all players (since properties were mortgaged/unmortgaged)
    for (const pId of Object.keys(players)) {
      const player = players[pId as PlayerId]!;
      const netWorth = PropertyManagementEngine.calculateNetWorth(player.money, player.properties, boardTiles, config);
      players[pId as PlayerId] = { ...player, netWorth };
    }

    const newState: GameState = {
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
