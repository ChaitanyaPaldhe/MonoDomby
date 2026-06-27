// =============================================================================
// engine/AuctionEngine.ts
// Auction subsystem.
//
// Design:
// - Auctions do not block turn progression — they run as a parallel subsystem.
// - The auction state lives in GameState.auction (null when no auction active).
// - Timer extension logic is purely state-based: the server's AuctionTimerWorker
//   reads GameState.auction.endsAt and triggers AUCTION_EXPIRE events.
// - All bid validation and state updates happen here as pure functions.
// =============================================================================

import { AuctionStatus } from '@monopoly/shared';
import type { GameState, PlayerId, TileId, AuctionState, BidEntry } from '@monopoly/shared';
import type { MapConfig } from '@monopoly/shared';
import type { EngineResult } from './types.js';
import { EngineNotImplementedError } from './errors.js';
import { ErrorCode } from '@monopoly/shared';
import { EngineValidationError } from './errors.js';

// ---------------------------------------------------------------------------
// AuctionEngine
// ---------------------------------------------------------------------------

/**
 * Manages the auction lifecycle as a pure state transformation.
 *
 * Sequence: startAuction → [placeBid]* → endAuction
 *
 * The timer mechanism lives in the server layer (AuctionTimerWorker).
 * The engine only computes whether an extension should happen on bid placement.
 */
export class AuctionEngine {
  // -------------------------------------------------------------------------
  // Auction Start
  // -------------------------------------------------------------------------

  /**
   * Initialise a new auction for an unowned tile.
   * Called when a player declines to purchase (and MapConfig.rules.auctionOnDecline is true).
   *
   * TODO: Implement.
   *
   * Rules:
   * 1. The tile must be unowned and not mortgaged.
   * 2. All non-bankrupt, connected players are participants (including the decliner).
   * 3. Starting bid is $1 (or mapConfig minBidIncrement).
   * 4. endsAt = now + auctionConfig.durationSeconds * 1000.
   * 5. Emit PROPERTY_AUCTIONED_START event.
   * 6. Set GameState.auction to the new AuctionState.
   *
   * @param state - Current game state (player has already declined purchase).
   * @param tileId - The tile being auctioned.
   * @param mapConfig - Map configuration for auction parameters.
   * @param now - Server timestamp (unix ms).
   */
  startAuction(
    state: GameState,
    tileId: TileId,
    mapConfig: MapConfig,
    now: number,
  ): EngineResult {
    // TODO: Implement
    throw new EngineNotImplementedError('AuctionEngine.startAuction');
  }

  // -------------------------------------------------------------------------
  // Bid Placement
  // -------------------------------------------------------------------------

  /**
   * Place a bid in the active auction.
   *
   * TODO: Implement.
   *
   * Validation:
   * 1. GameState.auction must not be null.
   * 2. auction.status must be ACTIVE or ENDING.
   * 3. Player must be in auction.participants.
   * 4. Player must have enough money: amount <= player.money.
   * 5. amount must be >= auction.currentBid + mapConfig.rules.auctionConfig.minBidIncrement.
   *
   * State changes:
   * 1. Append BidEntry to auction.bids.
   * 2. Update auction.currentBid and auction.currentBidderId.
   * 3. If remaining time <= extensionThreshold, extend endsAt by extensionSeconds.
   *    Increment extensionCount. Cap at maxExtensions.
   * 4. If time was extended, set status = ENDING (or keep ACTIVE).
   * 5. Emit AUCTION_BID_PLACED event (audience: ALL).
   * 6. Emit AUCTION_EXTENDED event if timer was extended (audience: ALL).
   *
   * @param state - Current game state.
   * @param playerId - Bidding player ID.
   * @param amount - Bid amount in game currency.
   * @param mapConfig - Map configuration for auction parameters.
   * @param now - Server timestamp (unix ms).
   */
  placeBid(
    state: GameState,
    playerId: PlayerId,
    amount: number,
    mapConfig: MapConfig,
    now: number,
  ): EngineResult {
    // TODO: Implement
    throw new EngineNotImplementedError('AuctionEngine.placeBid');
  }

  // -------------------------------------------------------------------------
  // Auction Fold
  // -------------------------------------------------------------------------

  /**
   * A player opts out of bidding (they may still watch).
   *
   * TODO: Implement.
   *
   * Rules:
   * 1. Remove player from auction.participants.
   * 2. If 0 participants remain, trigger endAuction with no winner.
   * 3. If 1 participant remains and they are the highest bidder, endAuction immediately.
   *
   * @param state - Current game state.
   * @param playerId - Player folding.
   * @param mapConfig - Map configuration.
   * @param now - Server timestamp (unix ms).
   */
  foldAuction(
    state: GameState,
    playerId: PlayerId,
    mapConfig: MapConfig,
    now: number,
  ): EngineResult {
    // TODO: Implement
    throw new EngineNotImplementedError('AuctionEngine.foldAuction');
  }

  // -------------------------------------------------------------------------
  // Auction End
  // -------------------------------------------------------------------------

  /**
   * Finalise an expired or naturally concluded auction.
   * Called by the server's AuctionTimerWorker when endsAt has passed,
   * or by foldAuction when all participants have folded.
   *
   * TODO: Implement.
   *
   * Rules:
   * 1. If auction.currentBidderId is null → no bids; property remains with bank.
   *    Emit PROPERTY_AUCTIONED_UNSOLD event.
   * 2. If there is a winner:
   *    a. Transfer amount from player.money to bank.money.
   *    b. Set board.tiles[tileId].ownerId = winnerId.
   *    c. Append tileId to player.properties.
   *    d. Emit PROPERTY_AUCTIONED_SOLD event.
   * 3. Set GameState.auction = null.
   * 4. Emit AUCTION_COMPLETE event (audience: ALL).
   *
   * @param state - Current game state.
   * @param mapConfig - Map configuration.
   * @param now - Server timestamp (unix ms).
   */
  endAuction(
    state: GameState,
    mapConfig: MapConfig,
    now: number,
  ): EngineResult {
    // TODO: Implement
    throw new EngineNotImplementedError('AuctionEngine.endAuction');
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Compute whether a bid at `now` should extend the auction timer.
   * Returns the new endsAt if extension is warranted, null otherwise.
   *
   * TODO: Implement.
   */
  private computeExtension(
    auction: AuctionState,
    auctionConfig: MapConfig['rules']['auctionConfig'],
    now: number,
  ): number | null {
    // TODO: Implement
    throw new EngineNotImplementedError('AuctionEngine.computeExtension');
  }

  /**
   * Assert that an auction is currently active.
   * @throws EngineValidationError if no auction is active.
   */
  private requireActiveAuction(state: GameState): AuctionState {
    if (!state.auction) {
      throw new EngineValidationError(
        'No auction is currently active.',
        ErrorCode.E_INVALID_PHASE,
      );
    }
    if (state.auction.status === AuctionStatus.COMPLETE) {
      throw new EngineValidationError(
        'Auction has already ended.',
        ErrorCode.E_AUCTION_ENDED,
      );
    }
    return state.auction;
  }
}
