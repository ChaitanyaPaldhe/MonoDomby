import { Pool, PoolClient } from 'pg';
import { IRoomRepository, RoomRecord } from './interfaces.js';
export declare class RoomRepository implements IRoomRepository {
    private client;
    constructor(client: Pool | PoolClient);
    findById(roomId: string): Promise<RoomRecord | null>;
    findByJoinCode(joinCode: string): Promise<RoomRecord | null>;
    listActiveRooms(): Promise<RoomRecord[]>;
    create(room: Omit<RoomRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
    update(roomId: string, updates: Partial<RoomRecord>): Promise<void>;
    delete(roomId: string): Promise<void>;
    private mapToRecord;
}
//# sourceMappingURL=RoomRepository.d.ts.map