// =============================================================================
// engine/TradeEngine.ts
// Trade negotiation subsystem.
//
// Design:
// - Trades run in parallel to the active turn — they do not pause gameplay.
// - Multiple trades may be active simultaneously (different player pairs).
// - Trade state lives in GameState.activeTrades (Record<TradeId, TradeState>).
// - Trades auto-expire after TradeState.expiresAt.
// - All trade mutations return new state; nothing is mutated in place.
// =============================================================================
;
import { ErrorCode } from '@monopoly/shared';
import { EngineValidationError, EngineNotImplementedError } from './errors.js';
// ---------------------------------------------------------------------------
// Trade constants
// ---------------------------------------------------------------------------
/** Default trade expiry: 5 minutes after creation. */
const DEFAULT_TRADE_EXPIRY_MS = 5 * 60 * 1000;
// ---------------------------------------------------------------------------
// TradeEngine
// ---------------------------------------------------------------------------
/**
 * Manages the trade lifecycle as pure state transformations.
 *
 * State machine:
 *   PENDING → COUNTERED → ACCEPTED → [applied]
 *           ↓
 *     REJECTED / CANCELLED
 */
export class TradeEngine {
    // -------------------------------------------------------------------------
    // Propose
    // -------------------------------------------------------------------------
    /**
     * Initiator proposes a trade to a target player.
     *
     * TODO: Implement.
     *
     * Validation:
     * 1. Initiator is not bankrupt.
     * 2. Target is not bankrupt.
     * 3. Initiator != target.
     * 4. All properties in offer.properties are owned by initiator.
     * 5. All properties in request.properties are owned by target.
     * 6. offer.money <= initiator.money.
     * 7. request.money <= target.money.
     * 8. offer.jailCards <= initiator.getOutOfJailCards.
     * 9. request.jailCards <= target.getOutOfJailCards.
     *
     * State changes:
     * 1. Generate a new TradeId (UUID).
     * 2. Create TradeState { status: PENDING, createdAt: now, expiresAt: now + 5min }.
     * 3. Add to activeTrades.
     * 4. Emit TRADE_PROPOSED event { audience: PLAYER(targetId) }.
     *
     * @param state - Current game state.
     * @param initiatorId - Player proposing the trade.
     * @param targetId - Player receiving the proposal.
     * @param offer - What initiator gives.
     * @param request - What initiator wants in return.
     * @param mapConfig - Map configuration.
     * @param now - Server timestamp (unix ms).
     */
    proposeTrade(state, initiatorId, targetId, offer, request, mapConfig, now) {
        // TODO: Implement
        throw new EngineNotImplementedError('TradeEngine.proposeTrade');
    }
    // -------------------------------------------------------------------------
    // Counter
    // -------------------------------------------------------------------------
    /**
     * Target (or initiator, after a counter) sends a counter-offer.
     *
     * TODO: Implement.
     *
     * Validation:
     * 1. Trade exists and is PENDING or COUNTERED.
     * 2. Trade is not expired (now < expiresAt).
     * 3. Counter is sent by the correct party (alternates each counter).
     * 4. Same property ownership and money validations as proposeTrade.
     *
     * State changes:
     * 1. Update trade offer/request with new values.
     * 2. Set status = COUNTERED.
     * 3. Swap which player is expected to respond next (stored implicitly by initiator/target roles).
     * 4. Emit TRADE_COUNTERED event { audience: PLAYER(other party) }.
     *
     * @param state - Current game state.
     * @param playerId - Player sending the counter.
     * @param tradeId - Trade being countered.
     * @param newOffer - Updated offer from counter-proposing player's perspective.
     * @param newRequest - Updated request from counter-proposing player's perspective.
     * @param mapConfig - Map configuration.
     * @param now - Server timestamp (unix ms).
     */
    counterTrade(state, playerId, tradeId, newOffer, newRequest, mapConfig, now) {
        // TODO: Implement
        throw new EngineNotImplementedError('TradeEngine.counterTrade');
    }
    // -------------------------------------------------------------------------
    // Accept
    // -------------------------------------------------------------------------
    /**
     * Accepting party agrees to the current trade terms.
     *
     * TODO: Implement.
     *
     * Validation:
     * 1. Trade exists and is PENDING or COUNTERED.
     * 2. Trade is not expired.
     * 3. Acceptor is the correct responding party.
     * 4. Re-validate ownership and money (state may have changed since proposal).
     *
     * State changes:
     * 1. Set trade.status = ACCEPTED.
     * 2. Execute the transfer via executeTrade().
     * 3. Emit TRADE_ACCEPTED event { audience: ALL }.
     * 4. Emit TRADE_EXECUTED event { audience: ALL }.
     * 5. Remove trade from activeTrades.
     *
     * @param state - Current game state.
     * @param playerId - Player accepting.
     * @param tradeId - Trade being accepted.
     * @param mapConfig - Map configuration.
     * @param now - Server timestamp (unix ms).
     */
    acceptTrade(state, playerId, tradeId, mapConfig, now) {
        // TODO: Implement
        throw new EngineNotImplementedError('TradeEngine.acceptTrade');
    }
    // -------------------------------------------------------------------------
    // Reject
    // -------------------------------------------------------------------------
    /**
     * Responding party rejects the trade offer.
     *
     * TODO: Implement.
     *
     * State changes:
     * 1. Set trade.status = REJECTED.
     * 2. Remove from activeTrades.
     * 3. Emit TRADE_REJECTED event { audience: PLAYER(initiatorId) }.
     *
     * @param state - Current game state.
     * @param playerId - Player rejecting.
     * @param tradeId - Trade being rejected.
     * @param now - Server timestamp.
     */
    rejectTrade(state, playerId, tradeId, now) {
        // TODO: Implement
        throw new EngineNotImplementedError('TradeEngine.rejectTrade');
    }
    // -------------------------------------------------------------------------
    // Cancel
    // -------------------------------------------------------------------------
    /**
     * Initiator withdraws the trade before it is accepted or rejected.
     *
     * TODO: Implement.
     *
     * Validation:
     * 1. Only the trade initiator may cancel.
     * 2. Trade must be PENDING or COUNTERED.
     *
     * State changes:
     * 1. Set trade.status = CANCELLED.
     * 2. Remove from activeTrades.
     * 3. Emit TRADE_CANCELLED event { audience: PLAYER(targetId) }.
     *
     * @param state - Current game state.
     * @param playerId - Player cancelling (must be initiator).
     * @param tradeId - Trade being cancelled.
     * @param now - Server timestamp.
     */
    cancelTrade(state, playerId, tradeId, now) {
        // TODO: Implement
        throw new EngineNotImplementedError('TradeEngine.cancelTrade');
    }
    // -------------------------------------------------------------------------
    // Expiry Cleanup
    // -------------------------------------------------------------------------
    /**
     * Remove all expired trades from GameState.activeTrades.
     * Called by the server's background expiry worker, not by a player action.
     *
     * TODO: Implement.
     *
     * Algorithm:
     * 1. Filter activeTrades where trade.expiresAt <= now.
     * 2. For each expired trade, emit TRADE_CANCELLED event.
     * 3. Return new state with expired trades removed.
     *
     * @param state - Current game state.
     * @param now - Server timestamp (unix ms).
     */
    expireOldTrades(state, now) {
        // TODO: Implement
        throw new EngineNotImplementedError('TradeEngine.expireOldTrades');
    }
    // -------------------------------------------------------------------------
    // Asset Transfer (private)
    // -------------------------------------------------------------------------
    /**
     * Execute the actual asset exchange between two players.
     * Called internally when a trade is ACCEPTED.
     *
     * TODO: Implement.
     *
     * Transfer rules:
     * 1. initiator.money -= offer.money; target.money += offer.money.
     * 2. target.money -= request.money; initiator.money += request.money.
     * 3. For each property in offer.properties:
     *    - Remove from initiator.properties, add to target.properties.
     *    - Set board.tiles[tileId].ownerId = targetId.
     * 4. For each property in request.properties:
     *    - Remove from target.properties, add to initiator.properties.
     *    - Set board.tiles[tileId].ownerId = initiatorId.
     * 5. Transfer jail cards accordingly.
     * 6. Recompute netWorth for both players.
     *
     * @param state - Current game state.
     * @param trade - The accepted TradeState.
     */
    executeTrade(state, trade) {
        // TODO: Implement
        throw new EngineNotImplementedError('TradeEngine.executeTrade');
    }
    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------
    /**
     * Retrieve a trade or throw if not found.
     * @throws EngineValidationError
     */
    requireTrade(state, tradeId) {
        const trade = state.activeTrades[tradeId];
        if (!trade) {
            throw new EngineValidationError(`Trade '${tradeId}' not found.`, ErrorCode.E_TRADE_NOT_FOUND);
        }
        return trade;
    }
    /**
     * Check if a trade has expired.
     * @throws EngineValidationError if expired.
     */
    assertNotExpired(trade, now) {
        if (now >= trade.expiresAt) {
            throw new EngineValidationError(`Trade '${trade.id}' has expired.`, ErrorCode.E_TRADE_EXPIRED);
        }
    }
}
//# sourceMappingURL=TradeEngine.js.map