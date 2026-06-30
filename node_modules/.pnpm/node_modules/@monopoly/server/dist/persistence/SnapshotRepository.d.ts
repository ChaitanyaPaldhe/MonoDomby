import { Pool, PoolClient } from 'pg';
import { ISnapshotRepository, SnapshotRecord } from './interfaces.js';
export declare class SnapshotRepository implements ISnapshotRepository {
    private client;
    constructor(client: Pool | PoolClient);
    findLatestBefore(gameId: string, actionIndex: number): Promise<SnapshotRecord | null>;
    save(snapshot: Omit<SnapshotRecord, 'createdAt'>): Promise<void>;
    private mapToRecord;
}
//# sourceMappingURL=SnapshotRepository.d.ts.map