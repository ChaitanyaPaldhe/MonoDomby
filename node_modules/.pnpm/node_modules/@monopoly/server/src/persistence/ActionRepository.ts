import { Pool, PoolClient } from 'pg';
import { IActionRepository, ActionRecord, EventRecord } from './interfaces.js';

export class ActionRepository implements IActionRepository {
  constructor(private client: Pool | PoolClient) {}

  public async getActionsAfter(gameId: string, actionIndex: number): Promise<ActionRecord[]> {
    const res = await this.client.query(
      `SELECT id, game_id, action_index, client_action_payload, created_at 
       FROM actions 
       WHERE game_id = $1 AND action_index > $2
       ORDER BY action_index ASC`,
      [gameId, actionIndex]
    );

    return res.rows.map(this.mapToActionRecord);
  }

  public async saveActionWithEvents(
    action: Omit<ActionRecord, 'createdAt'>, 
    events: Omit<EventRecord, 'createdAt'>[]
  ): Promise<void> {
    // Note: The orchestrator uses Unit of Work to wrap this in a transaction if needed.
    // However, if we aren't wrapped in a UOW, we can just run the queries back-to-back.
    // For absolute atomicity, the caller should invoke via database.transaction(uow => ...)
    
    await this.client.query(
      `INSERT INTO actions (id, game_id, action_index, client_action_payload)
       VALUES ($1, $2, $3, $4)`,
      [
        action.id,
        action.gameId,
        action.actionIndex,
        JSON.stringify(action.clientActionPayload)
      ]
    );

    if (events.length > 0) {
      await this.saveEvents(events);
    }
  }

  public async saveEvents(events: Omit<EventRecord, 'createdAt'>[]): Promise<void> {
    if (events.length === 0) return;

    // Use parameterized batch insert
    const values: any[] = [];
    const placeholders: string[] = [];
    
    events.forEach((evt, i) => {
      const offset = i * 4;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
      values.push(evt.id, evt.gameId, evt.actionId, evt.sequenceNumber, JSON.stringify(evt.eventPayload));
    });

    await this.client.query(
      `INSERT INTO events (id, game_id, action_id, sequence_number, event_payload)
       VALUES ${placeholders.join(', ')}`,
      values
    );
  }

  private mapToActionRecord(row: any): ActionRecord {
    return {
      id: row.id,
      gameId: row.game_id,
      actionIndex: row.action_index,
      clientActionPayload: row.client_action_payload, // pg parses JSONB automatically
      createdAt: row.created_at,
    };
  }
}
