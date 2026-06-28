"use strict";
// =============================================================================
// engine/BankruptcyEngine.ts
// Bankruptcy resolution subsystem.
//
// Design:
// - Bankruptcy triggers when a player owes more than they can raise.
// - The engine gives the player a chance to liquidate assets first.
// - If still unable to pay, bankruptcy is declared and assets are transferred.
// - Asset transfer target: creditor (if player) or bank (if tax/rent to bank).
// - After bankruptcy: player.isBankrupt = true, player removed from turn order.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankruptcyEngine = void 0;
const errors_js_1 = require("./errors.js");
// ---------------------------------------------------------------------------
// BankruptcyEngine
// ---------------------------------------------------------------------------
/**
 * Handles all bankruptcy-related state transitions.
 *
 * Called by the ActionProcessor when:
 * - A player cannot pay rent, tax, or an unmortgage fee.
 * - A player explicitly sends DECLARE_BANKRUPTCY.
 */
class BankruptcyEngine {
    // -------------------------------------------------------------------------
    // Debt Check
    // -------------------------------------------------------------------------
    /**
     * Determine whether a player can potentially satisfy a debt through liquidation.
     *
     * TODO: Implement.
     *
     * Algorithm:
     * 1. Compute the player's maximum liquidation value:
     *    - For each owned, unmortgaged property: mortgageValue
     *    - For each house on a property: houseCost / 2 (sell-back value)
     *    - For each hotel: hotelCost / 2
     *    - Already mortgaged properties contribute 0.
     * 2. If player.money + maxLiquidation >= debt → player CAN liquidate.
     *    Return { canSatisfy: true, maxRaisable: player.money + maxLiquidation }.
     * 3. Otherwise → player cannot avoid bankruptcy.
     *    Return { canSatisfy: false, maxRaisable: ... }.
     *
     * @param state - Current game state.
     * @param playerId - Player who owes the debt.
     * @param debtAmount - Amount owed.
     * @param mapConfig - Map configuration (for house/hotel sell-back rates).
     */
    canSatisfyDebt(state, playerId, debtAmount, mapConfig) {
        // TODO: Implement
        throw new errors_js_1.EngineNotImplementedError('BankruptcyEngine.canSatisfyDebt');
    }
    // -------------------------------------------------------------------------
    // Declare Bankruptcy
    // -------------------------------------------------------------------------
    /**
     * Formally declare a player bankrupt and transfer their assets.
     *
     * TODO: Implement.
     *
     * Preconditions:
     * - The player cannot satisfy the debt even after full liquidation.
     *
     * Algorithm:
     * 1. Sell ALL houses and hotels back to bank (full board, all groups).
     *    - bank.houses += total houses sold.
     *    - bank.hotels += total hotels sold.
     *    - Reset all tile states in player's group.
     * 2. Transfer all properties:
     *    - If creditorId != null (player-to-player debt):
     *      - Transfer each property to creditor at mortgage value if mortgaged.
     *      - Creditor inherits unmortgaged properties as-is.
     *      - Creditor must pay 10% unmortgage fee if they want to lift mortgages later.
     *    - If creditorId == null (bank debt — tax, etc.):
     *      - All properties return to bank (board.tiles[id].ownerId = null).
     *      - board.tiles[id].isMortgaged = false (bank resets).
     * 3. Transfer remaining cash to creditor (or discard to bank).
     * 4. Transfer any Get Out Of Jail Free cards to creditor (or return to deck).
     * 5. Set player.isBankrupt = true.
     * 6. Set player.properties = [].
     * 7. Set player.money = 0.
     * 8. Emit BANKRUPTCY_DECLARED event (audience: ALL).
     * 9. Emit ASSETS_TRANSFERRED event (audience: ALL).
     * 10. Recompute netWorth for affected players.
     *
     * @param state - Current game state.
     * @param playerId - Player going bankrupt.
     * @param creditorId - Who receives the assets. Null = returns to bank.
     * @param mapConfig - Map configuration.
     */
    declareBankruptcy(state, playerId, creditorId, mapConfig) {
        // TODO: Implement
        throw new errors_js_1.EngineNotImplementedError('BankruptcyEngine.declareBankruptcy');
    }
    // -------------------------------------------------------------------------
    // Asset Liquidation Helpers
    // -------------------------------------------------------------------------
    /**
     * Sell all buildings on ALL properties owned by a player back to the bank.
     * Must respect even-selling rule (parallel to even-building):
     * sell hotels first, then sell houses one at a time, maintaining balance.
     *
     * TODO: Implement.
     *
     * @param state - Current game state.
     * @param playerId - Player selling.
     * @param mapConfig - Map configuration.
     * @returns [newState, cashGenerated]
     */
    liquidateAllBuildings(state, playerId, mapConfig) {
        // TODO: Implement
        throw new errors_js_1.EngineNotImplementedError('BankruptcyEngine.liquidateAllBuildings');
    }
    /**
     * Transfer a single property from bankrupt player to creditor (or bank).
     *
     * TODO: Implement.
     *
     * Rules:
     * - If property is unmortgaged: transfer as-is; creditor owns it free and clear.
     * - If property is mortgaged: transfer with mortgage intact; creditor pays 10%
     *   fee at their discretion to unmortgage later.
     *
     * @param state - Current game state.
     * @param tileId - Property being transferred.
     * @param fromPlayerId - Bankrupt player.
     * @param toPlayerId - Creditor. Null = return to bank.
     * @param mapConfig - Map configuration.
     */
    transferProperty(state, tileId, fromPlayerId, toPlayerId, mapConfig) {
        // TODO: Implement
        throw new errors_js_1.EngineNotImplementedError('BankruptcyEngine.transferProperty');
    }
    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------
    /**
     * Compute the maximum cash a player could raise by mortgaging
     * all unmortgaged properties and selling all buildings.
     * Used by canSatisfyDebt.
     *
     * TODO: Implement.
     */
    computeMaxRaisable(state, playerId, mapConfig) {
        // TODO: Implement
        throw new errors_js_1.EngineNotImplementedError('BankruptcyEngine.computeMaxRaisable');
    }
}
exports.BankruptcyEngine = BankruptcyEngine;
//# sourceMappingURL=BankruptcyEngine.js.map