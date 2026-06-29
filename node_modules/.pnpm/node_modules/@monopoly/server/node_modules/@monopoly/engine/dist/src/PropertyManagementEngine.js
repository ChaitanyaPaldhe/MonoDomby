"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertyManagementEngine = void 0;
;
class PropertyManagementEngine {
    /**
     * Calculates the net worth of a player:
     * Cash + Mortgage value of all unmortgaged properties
     * + (Cost per house / 2) for all houses/hotels.
     */
    static calculateNetWorth(playerMoney, playerProperties, boardTiles, mapConfig) {
        let netWorth = playerMoney;
        for (const tileId of playerProperties) {
            const ts = boardTiles[tileId];
            const t = mapConfig.board.tiles.find(x => x.id === tileId);
            if (ts && t && (t.propertyData || t.railroadData || t.utilityData)) {
                const mortgageValue = t.propertyData?.mortgageValue ?? t.railroadData?.mortgageValue ?? t.utilityData?.mortgageValue ?? 0;
                if (ts.isMortgaged) {
                    const multiplier = mapConfig.rules.mortgagedPropertyValuation ?? 0.5;
                    netWorth += mortgageValue * multiplier;
                }
                else {
                    netWorth += mortgageValue;
                    if (t.propertyData) {
                        const houseCost = t.propertyData.houseCost;
                        const hotelCost = t.propertyData.hotelCost;
                        netWorth += (ts.houses * houseCost) / 2;
                        if (ts.hasHotel) {
                            netWorth += (hotelCost / 2) + (4 * houseCost / 2);
                        }
                    }
                }
            }
        }
        return netWorth;
    }
    static applyTransaction(state, plan, mapConfig, playerId) {
        const players = { ...state.players };
        const bank = { ...state.bank };
        const boardTiles = { ...state.board.tiles };
        // 1. Apply Bank changes
        if (!mapConfig.bank?.infiniteMoney) {
            bank.money -= plan.playerMoneyChange;
        }
        bank.houses += plan.bankHouseChange;
        bank.hotels += plan.bankHotelChange;
        // 2. Apply Player changes
        const p = players[playerId];
        if (p) {
            players[playerId] = { ...p, money: p.money + plan.playerMoneyChange };
        }
        // 3. Apply Tile changes
        for (const [tileId, tileState] of Object.entries(plan.tileChanges)) {
            boardTiles[tileId] = tileState;
        }
        // 4. Recalculate net worth for all players (since mortgages can affect net worth dynamically)
        for (const pId of Object.keys(players)) {
            const p = players[pId];
            const netWorth = this.calculateNetWorth(p.money, p.properties, boardTiles, mapConfig);
            players[pId] = { ...p, netWorth };
        }
        const newState = {
            ...state,
            bank,
            players,
            board: {
                ...state.board,
                tiles: boardTiles
            }
        };
        return { newState, events: plan.events };
    }
}
exports.PropertyManagementEngine = PropertyManagementEngine;
//# sourceMappingURL=PropertyManagementEngine.js.map