"use strict";
// =============================================================================
// engine/AuctionEngine.ts
// Auction subsystem.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuctionEngine = void 0;
const shared_1 = require("@monopoly/shared");
const errors_js_1 = require("./errors.js");
class AuctionEngine {
    /**
     * Generates a deterministic Auction ID from the Tile ID and current game time.
     */
    generateAuctionId(tileId, clientTs) {
        return `auction-${tileId}-${clientTs}`;
    }
    /**
     * Creates a standardized EventLogEntry.
     */
    createEvent(state, type, payload, clientTs) {
        const id = `${state.id}-${clientTs}-${type}`;
        return {
            id,
            ts: clientTs,
            roomId: state.roomId,
            gameId: state.id,
            audience: { type: 'ALL' },
            type,
            payload,
        };
    }
    /**
     * Initialise a new auction for an unowned tile.
     * Called when a player declines to purchase (and MapConfig.rules.auctionOnDecline is true).
     */
    startAuction(state, tileId, mapConfig, now) {
        const tile = mapConfig.board.tiles.find((t) => t.id === tileId);
        if (!tile) {
            throw new errors_js_1.EngineStateCorruptionError(`startAuction: Tile '${tileId}' not found in MapConfig`);
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
        const auctionState = {
            id: this.generateAuctionId(tileId, now),
            tileId,
            startedAt: now,
            endsAt: now + auctionConfig.durationSeconds * 1000,
            highestBid: 0,
            highestBidder: null,
            bids: [],
            activeBidders,
            foldedPlayers: [],
            status: shared_1.AuctionStatus.ACTIVE,
            extensionCount: 0,
        };
        const newState = {
            ...state,
            phase: shared_1.GamePhase.AUCTION,
            auction: auctionState,
            turn: {
                ...state.turn,
                pendingDecision: null, // Clear the PURCHASE decision
            },
        };
        const event = this.createEvent(newState, shared_1.EventType.PROPERTY_AUCTIONED_START, { tileId, startingBid, auction: auctionState }, now);
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
    placeBid(state, playerId, amount, mapConfig, now) {
        const auction = this.requireActiveAuction(state);
        if (!auction.activeBidders.includes(playerId)) {
            throw new errors_js_1.EngineValidationError('You are not an active bidder in this auction', shared_1.ErrorCode.E_UNAUTHORIZED);
        }
        const player = state.players[playerId];
        if (!player) {
            throw new errors_js_1.EngineStateCorruptionError(`Player ${playerId} not found`);
        }
        const auctionConfig = mapConfig.rules.auctionConfig ?? {
            durationSeconds: 30,
            overtimeSeconds: 10,
            minBidIncrement: 5,
        };
        if (amount <= auction.highestBid) {
            throw new errors_js_1.EngineValidationError('Bid must be strictly greater than current highest bid', shared_1.ErrorCode.E_BID_TOO_LOW);
        }
        // If it's the very first bid, they just need to match the minimum start bid.
        // Otherwise, increment by minBidIncrement
        const minRequiredBid = auction.highestBid === 0
            ? auctionConfig.minBidIncrement
            : auction.highestBid + auctionConfig.minBidIncrement;
        if (amount < minRequiredBid) {
            throw new errors_js_1.EngineValidationError(`Bid must be at least ${minRequiredBid}`, shared_1.ErrorCode.E_BID_TOO_LOW);
        }
        if (player.money < amount) {
            throw new errors_js_1.EngineValidationError('Insufficient funds', shared_1.ErrorCode.E_DEBT_RECOVERY);
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
        const bidEntry = {
            playerId: playerId,
            amount,
            timestamp: now,
        };
        const newAuctionState = {
            ...auction,
            highestBid: amount,
            highestBidder: playerId,
            bids: [...auction.bids, bidEntry],
            endsAt,
            extensionCount,
            status: extended ? shared_1.AuctionStatus.ENDING : auction.status,
        };
        const newState = {
            ...state,
            auction: newAuctionState,
        };
        const events = [];
        events.push(this.createEvent(newState, shared_1.EventType.AUCTION_BID_PLACED, {
            auctionId: auction.id,
            playerId: playerId,
            amount,
            newEndsAt: endsAt,
        }, now));
        if (extended) {
            events.push(this.createEvent(newState, shared_1.EventType.AUCTION_EXTENDED, {
                auctionId: auction.id,
                newEndsAt: endsAt,
                extensionCount,
            }, now));
        }
        return { newState, events };
    }
    /**
     * A player opts out of bidding.
     */
    foldAuction(state, playerId, mapConfig, now) {
        const auction = this.requireActiveAuction(state);
        if (!auction.activeBidders.includes(playerId)) {
            throw new errors_js_1.EngineValidationError('You are not an active bidder', shared_1.ErrorCode.E_UNAUTHORIZED);
        }
        const newActiveBidders = auction.activeBidders.filter(id => id !== playerId);
        const newFoldedPlayers = [...auction.foldedPlayers, playerId];
        const newAuctionState = {
            ...auction,
            activeBidders: newActiveBidders,
            foldedPlayers: newFoldedPlayers,
        };
        const newState = {
            ...state,
            auction: newAuctionState,
        };
        const autoResolve = newActiveBidders.length === 0 ||
            (newActiveBidders.length === 1 && newAuctionState.highestBidder !== null);
        if (autoResolve) {
            return this.endAuction(newState, mapConfig, now);
        }
        return { newState, events: [] };
    }
    /**
     * Finalise an expired or naturally concluded auction.
     */
    endAuction(state, mapConfig, now) {
        const auction = state.auction;
        if (!auction) {
            throw new errors_js_1.EngineStateCorruptionError('endAuction: No auction active');
        }
        const events = [];
        let newState = { ...state };
        const completeEvent = this.createEvent(newState, shared_1.EventType.AUCTION_COMPLETE, {
            auctionId: auction.id,
            winnerId: auction.highestBidder,
            finalBid: auction.highestBid,
            tileId: auction.tileId,
        }, now);
        events.push(completeEvent);
        if (auction.highestBidder !== null) {
            // We have a winner
            const winner = newState.players[auction.highestBidder];
            if (!winner)
                throw new errors_js_1.EngineStateCorruptionError('Winner not found');
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
                            ...newState.board.tiles[auction.tileId],
                            ownerId: winner.id,
                        },
                    },
                },
                players: {
                    ...newState.players,
                    [winner.id]: {
                        ...newState.players[winner.id],
                        properties: [...newState.players[winner.id].properties, auction.tileId],
                    }
                }
            };
            const soldEvent = this.createEvent(newState, shared_1.EventType.PROPERTY_AUCTIONED_SOLD, {
                tileId: auction.tileId,
                winnerId: winner.id,
                finalBid: auction.highestBid,
            }, now);
            events.push(soldEvent);
        }
        else {
            // Unsold
            const unsoldEvent = this.createEvent(newState, shared_1.EventType.PROPERTY_AUCTIONED_UNSOLD, {
                tileId: auction.tileId,
            }, now);
            events.push(unsoldEvent);
        }
        // Restore phase to IN_PROGRESS so the original turn player can end their turn.
        newState = {
            ...newState,
            phase: shared_1.GamePhase.IN_PROGRESS,
            auction: null,
        };
        return { newState, events };
    }
    computeExtension(auction, auctionConfig, now) {
        if (!auctionConfig)
            return null;
        const timeRemaining = auction.endsAt - now;
        const thresholdMs = auctionConfig.extensionThreshold * 1000;
        const extensionMs = auctionConfig.extensionSeconds * 1000;
        if (timeRemaining < thresholdMs && timeRemaining > 0 && auction.extensionCount < auctionConfig.maxExtensions) {
            return now + extensionMs;
        }
        else if (timeRemaining <= 0 && auction.extensionCount < auctionConfig.maxExtensions) {
            return now + extensionMs;
        }
        return null;
    }
    requireActiveAuction(state) {
        if (!state.auction) {
            throw new errors_js_1.EngineValidationError('No auction is currently active.', shared_1.ErrorCode.E_INVALID_PHASE);
        }
        if (state.auction.status === shared_1.AuctionStatus.COMPLETE) {
            throw new errors_js_1.EngineValidationError('Auction has already ended.', shared_1.ErrorCode.E_AUCTION_ENDED);
        }
        return state.auction;
    }
}
exports.AuctionEngine = AuctionEngine;
//# sourceMappingURL=AuctionEngine.js.map