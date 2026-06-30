import { Pool, PoolClient } from 'pg';
import { IReplayRepository, ReplayMetadata, ReplayData } from './interfaces.js';
export declare class ReplayRepository implements IReplayRepository {
    private client;
    private snapshotRepo;
    private actionRepo;
    constructor(client: Pool | PoolClient);
    getMetadata(gameId: string): Promise<ReplayMetadata | null>;
    saveMetadata(metadata: Omit<ReplayMetadata, 'recordedAt'>): Promise<void>;
    getFullReplay(gameId: string): Promise<ReplayData | null>;
}
//# sourceMappingURL=ReplayRepository.d.ts.map