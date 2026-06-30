import express from 'express';
import { createServer } from 'http';
import { GameEngine } from '@monopoly/engine';
import { MapConfig } from '@monopoly/maps';
import { GameEvent } from '@monopoly/shared';
import { GameService } from './game/GameService.js';
import { SocketServer } from './socket/SocketServer.js';
import { Database } from './persistence/Database.js';

async function bootstrap() {
  const app = express();
  const httpServer = createServer(app);

  // 1. Initialize Postgres Database
  const dbConnectionString = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/monopoly';
  const db = new Database(dbConnectionString);

  // 2. Setup lazy io reference for broadcasting
  let socketServer: SocketServer | null = null;
  const broadcastFactory = (roomId: string) => {
    return (events: readonly any[]) => {
      if (socketServer) {
        socketServer.getServer().to(roomId).emit('action_applied', { roomId, action: {} as any, events });
      }
    };
  };

  // 3. Initialize GameService
  const defaultRoomConfig = {
    maxPlayers: 8,
    snapshotInterval: 100,
    turnTimeoutMs: 60000,
    auctionTimeoutMs: 30000,
    reconnectTimeoutMs: 120000
  };

  const persistAction = async (action: any, index: number, events: readonly GameEvent[]) => {
    try {
      const actionRecord = {
        id: crypto.randomUUID(),
        gameId: action.gameId || 'unknown-game',
        actionIndex: index,
        clientActionPayload: action
      };
      
      const eventRecords = events.map((e, i) => ({
        id: crypto.randomUUID(),
        gameId: action.gameId || 'unknown-game',
        actionId: actionRecord.id,
        sequenceNumber: index * 1000 + i,
        eventPayload: e
      }));
      
      await db.actions.saveActionWithEvents(actionRecord, eventRecords);
    } catch (err) {
      console.error('Failed to persist action:', err);
    }
  };

  const persistSnapshot = async (state: any, index: number) => {
    try {
      await db.snapshots.save({
        id: crypto.randomUUID(),
        gameId: state.id,
        actionIndex: index,
        version: state.version.toString(),
        checksum: state.checksum,
        snapshotPayload: state
      });
    } catch (err) {
      console.error('Failed to persist snapshot:', err);
    }
  };

  const dummyTiles = Array.from({ length: 40 }).map((_, i) => ({
    id: `tile_${i}`,
    index: i,
    type: i === 10 ? 'JAIL' : i === 0 ? 'GO' : 'PROPERTY',
    name: `Tile ${i}`,
    propertyData: i !== 10 && i !== 0 ? {
      groupId: 'dummy-group',
      price: 100,
      rents: { base: 10, colorGroup: 20, oneHouse: 30, twoHouses: 40, threeHouses: 50, fourHouses: 60, hotel: 70 },
      houseCost: 50,
      hotelCost: 50,
      mortgageValue: 50,
      unmortgageCost: 55
    } : undefined
  }));

  const dummyMapConfig: MapConfig = {
    schemaVersion: '1.0',
    meta: { id: 'classic', name: 'Classic Monopoly', playerTokens: [] },
    bank: { startingMoney: 1500, infiniteMoney: true, initialHouses: 32, initialHotels: 12, goReward: 200 },
    board: {
      size: 40,
      jailTileIndex: 10,
      tiles: dummyTiles as any,
      propertyGroups: [
        { id: 'dummy-group', name: 'Dummy', color: '#000000', tileIds: dummyTiles.filter(t => t.type === 'PROPERTY').map(t => t.id) }
      ]
    },
    cards: { chance: [], communityChest: [] },
    rules: {
      auctionOnDecline: true,
      evenBuildingRequired: true,
      maxTurnsInJail: 3,
      jailFine: 50,
      doublesForJailRelease: true,
      freeParkingMoney: false,
      mortgagedPropertyValuation: 0.5,
      bankruptcyToBank: false,
      winCondition: 'LAST_PLAYER_STANDING' as any,
      auctionConfig: { durationSeconds: 30, extensionSeconds: 10, extensionThreshold: 5, minBidIncrement: 10, maxExtensions: 10 }
    }
  };

  const engine = new GameEngine();
  const gameService = new GameService(
    engine,
    dummyMapConfig,
    defaultRoomConfig,
    persistAction,
    persistSnapshot,
    broadcastFactory
  );

  // 4. Initialize SocketServer
  socketServer = new SocketServer(httpServer, gameService, ['*']);

  // 5. Expose Health Endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // 6. Start Listening
  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down server...');
    socketServer?.close();
    await db.close();
    process.exit(0);
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch(err => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
