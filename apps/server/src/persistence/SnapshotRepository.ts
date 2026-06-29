import { Pool, PoolClient } from 'pg';
import { ISnapshotRepository, SnapshotRecord } from './interfaces.js';

export class SnapshotRepository implements ISnapshotRepository {
  constructor(private client: Pool | PoolClient) {}

  public async findLatestBefore(gameId: string, actionIndex: number): Promise<SnapshotRecord | null> {
    const res = await this.client.query(
      `SELECT id, game_id, action_index, version, checksum, snapshot_payload, created_at 
       FROM snapshots 
       WHERE game_id = $1 AND action_index <= $2
       ORDER BY action_index DESC
       LIMIT 1`,
      [gameId, actionIndex]
    );

    if (res.rows.length === 0) return null;
    return this.mapToRecord(res.rows[0]);
  }

  public async save(snapshot: Omit<SnapshotRecord, 'createdAt'>): Promise<void> {
    await this.client.query(
      `INSERT INTO snapshots (id, game_id, action_index, version, checksum, snapshot_payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        snapshot.id,
        snapshot.gameId,
        snapshot.actionIndex,
        snapshot.version,
        snapshot.checksum,
        JSON.stringify(snapshot.snapshotPayload)
      ]
    );
  }

  private mapToRecord(row: any): SnapshotRecord {
    return {
      id: row.id,
      gameId: row.game_id,
      actionIndex: row.action_index,
      version: row.version,
      checksum: row.checksum,
      snapshotPayload: row.snapshot_payload, // pg parses JSONB automatically
      createdAt: row.created_at,
    };
  }
}
