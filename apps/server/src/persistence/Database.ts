import { Pool, PoolClient } from 'pg';
import {
  IUnitOfWork,
  IRoomRepository,
  IGameRepository,
  ISnapshotRepository,
  IActionRepository,
  IReplayRepository
} from './interfaces.js';

// These will be imported later as we create them
import { RoomRepository } from './RoomRepository.js';
import { GameRepository } from './GameRepository.js';
import { SnapshotRepository } from './SnapshotRepository.js';
import { ActionRepository } from './ActionRepository.js';
import { ReplayRepository } from './ReplayRepository.js';

export class Database implements IUnitOfWork {
  private pool: Pool;
  
  // Repositories bound to the primary pool (non-transactional by default)
  public readonly rooms: IRoomRepository;
  public readonly games: IGameRepository;
  public readonly snapshots: ISnapshotRepository;
  public readonly actions: IActionRepository;
  public readonly replays: IReplayRepository;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.rooms = new RoomRepository(this.pool);
    this.games = new GameRepository(this.pool);
    this.snapshots = new SnapshotRepository(this.pool);
    this.actions = new ActionRepository(this.pool);
    this.replays = new ReplayRepository(this.pool);
  }

  /**
   * Tests the database connection.
   * Returns true if successful, false if connection fails.
   */
  public async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      client.release();
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Executes a block of work inside a managed transaction.
   * Exposes repositories bound to the specific transaction client.
   */
  public async transaction<T>(
    work: (uow: Omit<IUnitOfWork, 'transaction'>) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const txUow = {
        rooms: new RoomRepository(client),
        games: new GameRepository(client),
        snapshots: new SnapshotRepository(client),
        actions: new ActionRepository(client),
        replays: new ReplayRepository(client)
      };

      const result = await work(txUow);
      
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
