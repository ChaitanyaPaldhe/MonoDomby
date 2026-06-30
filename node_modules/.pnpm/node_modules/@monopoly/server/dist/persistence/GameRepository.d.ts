import { Pool, PoolClient } from 'pg';
import { IGameRepository, GameRecord } from './interfaces.js';
export declare class GameRepository implements IGameRepository {
    private client;
    constructor(client: Pool | PoolClient);
    findById(gameId: string): Promise<GameRecord | null>;
    create(game: Omit<GameRecord, 'createdAt'>): Promise<void>;
    update(gameId: string, updates: Partial<GameRecord>): Promise<void>;
    private mapToRecord;
}
//# sourceMappingURL=GameRepository.d.ts.map