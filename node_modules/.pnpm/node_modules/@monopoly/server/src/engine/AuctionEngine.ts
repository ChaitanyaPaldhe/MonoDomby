// =============================================================================
// engine/AuctionEngine.ts
// Auction subsystem.
// =============================================================================

import {
  ActionType,
  AuctionBidPlacedPayload,
  AuctionCompletePayload,
  AuctionExtendedPayload,
  AuctionId,
  AuctionState,
  AuctionStatus,
  BidEntry,
  ClientAction,
  ErrorCode,
  EventType,
  GamePhase,
  GameState,
  MapConfig,
  PlayerId,
  PropertyAuctionedSoldPayload,
  PropertyAuctionedStartPayload,
  PropertyAuctionedUnsoldPayload,
  TileId,
} from '@monopoly/shared';
import type { GameEvent } from '@monopoly/shared';
import type { EngineResult } from './types.js';
import { EngineStateCorruptionError, EngineValidationError } from './errors.js';

export class AuctionEngine {

  /**
   * Generates a deterministic Auction ID from the Tile ID and current game time.
   */
  private generateAuctionId(tileId: TileId, clientTs: number): AuctionId {
    return `auction-${tileId}-${clientTs}` as AuctionId;
  }

  /**
   * Creates a standardized EventLogEntry.
   */
  private createEvent<T extends EventType, P>(
    state: GameState,
    type: T,
    payload: P,
    clientTs: number,
  ): GameEvent {
    const id = `${state.id}-${clientTs}-${type}`;
    return {
      id,
      ts: clientTs,
      roomId: state.roomId,
      gameId: state.id,
      audience: { type: 'ALL' },
      type,
      payload,
    } as unknown as GameEvent;
  }

  /**
   * Initialise a new auction for an unowned tile.
   * Called when a player declines to purchase (and MapConfig.rules.auctionOnDecline is true).
   */
  startAuction(
    state: GameState,
    tileId: TileId,
    mapConfig: MapConfig,
    now: number,
  ): EngineResult {
    const tile = mapConfig.board.tiles.find((t) => t.id === tileId);
    if (!tile) {
      throw new EngineStateCorruptionError(`startAuction: Tile '${tileId}' not found in MapConfig`);
    }

    const startingBid = mapConfig.rules.auctionConfig?.minBidIncrement ?? 1; 
    const auctionConfig = mapConfig.rules.auctionConfig ?? {
      durationSeconds: 30,
      overtimeSeconds: 10,
      minBidIncrement: 5,
    };
    
    // Eligible participants are all non-bankrupt players
    const activeBidders = Object.values(state.players)
      .filter((p) => !p.isBankrupt)
      .map((p) => p.id);

    const auctionState: AuctionState = {
      id: this.generateAuctionId(tileId, now),
      tileId,
      startedAt: now,
      endsAt: now + auctionConfig.durationSeconds * 1000,
      highestBid: 0,
      highestBidder: null,
      bids: [],
      activeBidders,
      foldedPlayers: [],
      status: AuctionStatus.ACTIVE,
      extensionCount: 0,
    };

    const newState: GameState = {
      ...state,
      phase: GamePhase.AUCTION,
      auction: auctionState,
      turn: {
        ...state.turn,
        pendingDecision: null, // Clear the PURCHASE decision
      },
    };

    const event = this.createEvent(
      newState,
      EventType.PROPERTY_AUCTIONED_START,
      { tileId, startingBid, auction: auctionState } as PropertyAuctionedStartPayload,
      now
    );

    // Auto-resolve if nobody is eligible
    if (activeBidders.length === 0) {
      const emptyState = { ...newState, auction: auctionState };
      return this.endAuction(emptyState, mapConfig, now);
    }

    return { newState, events: [event] };
  }

  /**
   * Place a bid in the active auction.
   */
  placeBid(
    state: GameState,
    playerId: PlayerId,
    amount: number,
    mapConfig: MapConfig,
    now: number,
  ): EngineResult {
    const auction = this.requireActiveAuction(state);
    
    if (!auction.activeBidders.includes(playerId)) {
      throw new EngineValidationError('You are not an active bidder in this auction', ErrorCode.E_UNAUTHORIZED);
    }

    const player = state.players[playerId];
    if (!player) {
      throw new EngineStateCorruptionError(`Player ${playerId} not found`);
    }

    const auctionConfig = mapConfig.rules.auctionConfig ?? {
      durationSeconds: 30,
      overtimeSeconds: 10,
      minBidIncrement: 5,
    };

    if (amount <= auction.highestBid) {
      throw new EngineValidationError('Bid must be strictly greater than current highest bid', ErrorCode.E_BID_TOO_LOW);
    }
    
    // If it's the very first bid, they just need to match the minimum start bid.
    // Otherwise, increment by minBidIncrement
    const minRequiredBid = auction.highestBid === 0 
      ? auctionConfig.minBidIncrement 
      : auction.highestBid + auctionConfig.minBidIncrement;
      
    if (amount < minRequiredBid) {
      throw new EngineValidationError(`Bid must be at least ${minRequiredBid}`, ErrorCode.E_BID_TOO_LOW);
    }
    if (player.money < amount) {
      throw new EngineValidationError('Insufficient funds', ErrorCode.E_INSUFFICIENT_FUNDS);
    }

    let endsAt = auction.endsAt;
    let extensionCount = auction.extensionCount;
    let extended = false;
    
    const newEndsAt = this.computeExtension(auction, auctionConfig, now);
    if (newEndsAt !== null) {
      endsAt = newEndsAt;
      extensionCount += 1;
      extended = true;
    }

    const bidEntry: BidEntry = {
      playerId: playerId,
      amount,
      timestamp: now,
    };

    const newAuctionState: AuctionState = {
      ...auction,
      highestBid: amount,
      highestBidder: playerId,
      bids: [...auction.bids, bidEntry],
      endsAt,
      extensionCount,
      status: extended ? AuctionStatus.ENDING : auction.status,
    };

    const newState = {
      ...state,
      auction: newAuctionState,
    };

    const events: GameEvent[] = [];

    events.push(
      this.createEvent(
        newState,
        EventType.AUCTION_BID_PLACED,
        {
          auctionId: auction.id,
          playerId: playerId,
          amount,
          newEndsAt: endsAt,
        } as AuctionBidPlacedPayload,
        now
      )
    );

    if (extended) {
      events.push(
        this.createEvent(
          newState,
          EventType.AUCTION_EXTENDED,
          {
            auctionId: auction.id,
            newEndsAt: endsAt,
            extensionCount,
          } as AuctionExtendedPayload,
          now
        )
      );
    }

    return { newState, events };
  }

  /**
   * A player opts out of bidding.
   */
  foldAuction(
    state: GameState,
    playerId: PlayerId,
    mapConfig: MapConfig,
    now: number,
  ): EngineResult {
    const auction = this.requireActiveAuction(state);
    
    if (!auction.activeBidders.includes(playerId)) {
      throw new EngineValidationError('You are not an active bidder', ErrorCode.E_UNAUTHORIZED);
    }

    const newActiveBidders = auction.activeBidders.filter(id => id !== playerId);
    const newFoldedPlayers = [...auction.foldedPlayers, playerId];

    const newAuctionState: AuctionState = {
      ...auction,
      activeBidders: newActiveBidders,
      foldedPlayers: newFoldedPlayers,
    };

    const newState = {
      ...state,
      auction: newAuctionState,
    };

    const autoResolve = 
      newActiveBidders.length === 0 || 
      (newActiveBidders.length === 1 && newAuctionState.highestBidder !== null);

    if (autoResolve) {
      return this.endAuction(newState, mapConfig, now);
    }

    return { newState, events: [] };
  }

  /**
   * Finalise an expired or naturally concluded auction.
   */
  endAuction(
    state: GameState,
    mapConfig: MapConfig,
    now: number,
  ): EngineResult {
    const auction = state.auction;
    if (!auction) {
      throw new EngineStateCorruptionError('endAuction: No auction active');
    }

    const events: GameEvent[] = [];
    let newState = { ...state };

    const completeEvent = this.createEvent(
      newState,
      EventType.AUCTION_COMPLETE,
      {
        auctionId: auction.id,
        winnerId: auction.highestBidder,
        finalBid: auction.highestBid,
        tileId: auction.tileId,
      } as AuctionCompletePayload,
      now
    );
    events.push(completeEvent);

    if (auction.highestBidder !== null) {
      // We have a winner
      const winner = newState.players[auction.highestBidder];
      if (!winner) throw new EngineStateCorruptionError('Winner not found');

      // Deduct money
      newState = {
        ...newState,
        players: {
          ...newState.players,
          [winner.id]: {
            ...winner,
            money: winner.money - auction.highestBid,
          },
        },
      };

      // Property ownership transfer
      newState = {
        ...newState,
        board: {
          ...newState.board,
          tiles: {
            ...newState.board.tiles,
            [auction.tileId]: {
              ...newState.board.tiles[auction.tileId]!,
              ownerId: winner.id,
            },
          },
        },
        players: {
          ...newState.players,
          [winner.id]: {
            ...newState.players[winner.id]!,
            properties: [...newState.players[winner.id]!.properties, auction.tileId],
          }
        }
      };

      const soldEvent = this.createEvent(
        newState,
        EventType.PROPERTY_AUCTIONED_SOLD,
        {
          tileId: auction.tileId,
          winnerId: winner.id,
          finalBid: auction.highestBid,
        } as PropertyAuctionedSoldPayload,
        now
      );
      events.push(soldEvent);
    } else {
      // Unsold
      const unsoldEvent = this.createEvent(
        newState,
        EventType.PROPERTY_AUCTIONED_UNSOLD,
        {
          tileId: auction.tileId,
        } as PropertyAuctionedUnsoldPayload,
        now
      );
      events.push(unsoldEvent);
    }

    // Restore phase to IN_PROGRESS so the original turn player can end their turn.
    newState = {
      ...newState,
      phase: GamePhase.IN_PROGRESS,
      auction: null,
    };

    return { newState, events };
  }

  private computeExtension(
    auction: AuctionState,
    auctionConfig: NonNullable<MapConfig['rules']['auctionConfig']>,
    now: number,
  ): number | null {
    if (!auctionConfig) return null;
    
    const timeRemaining = auction.endsAt - now;
    const thresholdMs = auctionConfig.extensionThreshold * 1000;
    const extensionMs = auctionConfig.extensionSeconds * 1000;
    
    if (timeRemaining < thresholdMs && timeRemaining > 0 && auction.extensionCount < auctionConfig.maxExtensions) {
      return now + extensionMs;
    } else if (timeRemaining <= 0 && auction.extensionCount < auctionConfig.maxExtensions) {
      return now + extensionMs;
    }
    return null;
  }

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
