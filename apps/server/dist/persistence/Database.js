import { Pool } from 'pg';
// These will be imported later as we create them
import { RoomRepository } from './RoomRepository.js';
import { GameRepository } from './GameRepository.js';
import { SnapshotRepository } from './SnapshotRepository.js';
import { ActionRepository } from './ActionRepository.js';
import { ReplayRepository } from './ReplayRepository.js';
export class Database {
    pool;
    // Repositories bound to the primary pool (non-transactional by default)
    rooms;
    games;
    snapshots;
    actions;
    replays;
    constructor(connectionString) {
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
     * Executes a block of work inside a managed transaction.
     * Exposes repositories bound to the specific transaction client.
     */
    async transaction(work) {
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
        }
        catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
        finally {
            client.release();
        }
    }
    async close() {
        await this.pool.end();
    }
}
//# sourceMappingURL=Database.js.map