import { Pool, PoolClient } from 'pg';
import { IActionRepository, ActionRecord, EventRecord } from './interfaces.js';
export declare class ActionRepository implements IActionRepository {
    private client;
    constructor(client: Pool | PoolClient);
    getActionsAfter(gameId: string, actionIndex: number): Promise<ActionRecord[]>;
    saveActionWithEvents(action: Omit<ActionRecord, 'createdAt'>, events: Omit<EventRecord, 'createdAt'>[]): Promise<void>;
    saveEvents(events: Omit<EventRecord, 'createdAt'>[]): Promise<void>;
    private mapToActionRecord;
}
//# sourceMappingURL=ActionRepository.d.ts.map