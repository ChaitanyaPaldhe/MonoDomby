import { Pool, PoolClient } from 'pg';
import { IReplayRepository, ReplayMetadata, ReplayData } from './interfaces.js';
import { SnapshotRepository } from './SnapshotRepository.js';
import { ActionRepository } from './ActionRepository.js';

export class ReplayRepository implements IReplayRepository {
  private snapshotRepo: SnapshotRepository;
  private actionRepo: ActionRepository;

  constructor(private client: Pool | PoolClient) {
    this.snapshotRepo = new SnapshotRepository(client);
    this.actionRepo = new ActionRepository(client);
  }

  public async getMetadata(gameId: string): Promise<ReplayMetadata | null> {
    const res = await this.client.query(
      `SELECT game_id, total_actions, duration_seconds, player_count, recorded_at 
       FROM replay_metadata WHERE game_id = $1`,
      [gameId]
    );

    if (res.rows.length === 0) return null;
    
    return {
      gameId: res.rows[0].game_id,
      totalActions: res.rows[0].total_actions,
      durationSeconds: res.rows[0].duration_seconds,
      playerCount: res.rows[0].player_count,
      recordedAt: res.rows[0].recorded_at
    };
  }

  public async saveMetadata(metadata: Omit<ReplayMetadata, 'recordedAt'>): Promise<void> {
    await this.client.query(
      `INSERT INTO replay_metadata (game_id, total_actions, duration_seconds, player_count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (game_id) DO UPDATE SET 
         total_actions = EXCLUDED.total_actions,
         duration_seconds = EXCLUDED.duration_seconds,
         player_count = EXCLUDED.player_count,
         recorded_at = CURRENT_TIMESTAMP`,
      [metadata.gameId, metadata.totalActions, metadata.durationSeconds, metadata.playerCount]
    );
  }

  public async getFullReplay(gameId: string): Promise<ReplayData | null> {
    const metadata = await this.getMetadata(gameId);
    if (!metadata) return null;

    // Grab the absolute first snapshot (actionIndex = 0)
    const initialSnapshot = await this.snapshotRepo.findLatestBefore(gameId, 0);
    if (!initialSnapshot) return null;

    const actions = await this.actionRepo.getActionsAfter(gameId, -1);
    
    const eventsRes = await this.client.query(
      `SELECT id, game_id, action_id, sequence_number, event_payload, created_at
       FROM events
       WHERE game_id = $1
       ORDER BY sequence_number ASC`,
      [gameId]
    );

    const events = eventsRes.rows.map(row => ({
      id: row.id,
      gameId: row.game_id,
      actionId: row.action_id,
      sequenceNumber: row.sequence_number,
      eventPayload: row.event_payload,
      createdAt: row.created_at
    }));

    return {
      metadata,
      initialSnapshot,
      actions,
      events
    };
  }
}
