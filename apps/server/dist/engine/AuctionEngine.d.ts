import { GameState, MapConfig, PlayerId, TileId } from '@monopoly/shared';
import type { EngineResult } from './types.js';
export declare class AuctionEngine {
    /**
     * Generates a deterministic Auction ID from the Tile ID and current game time.
     */
    private generateAuctionId;
    /**
     * Creates a standardized EventLogEntry.
     */
    private createEvent;
    /**
     * Initialise a new auction for an unowned tile.
     * Called when a player declines to purchase (and MapConfig.rules.auctionOnDecline is true).
     */
    startAuction(state: GameState, tileId: TileId, mapConfig: MapConfig, now: number): EngineResult;
    /**
     * Place a bid in the active auction.
     */
    placeBid(state: GameState, playerId: PlayerId, amount: number, mapConfig: MapConfig, now: number): EngineResult;
    /**
     * A player opts out of bidding.
     */
    foldAuction(state: GameState, playerId: PlayerId, mapConfig: MapConfig, now: number): EngineResult;
    /**
     * Finalise an expired or naturally concluded auction.
     */
    endAuction(state: GameState, mapConfig: MapConfig, now: number): EngineResult;
    private computeExtension;
    private requireActiveAuction;
}
//# sourceMappingURL=AuctionEngine.d.ts.map