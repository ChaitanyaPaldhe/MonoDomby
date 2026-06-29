import { Pool, PoolClient } from 'pg';
import { IRoomRepository, RoomRecord } from './interfaces.js';

export class RoomRepository implements IRoomRepository {
  constructor(private client: Pool | PoolClient) {}

  public async findById(roomId: string): Promise<RoomRecord | null> {
    const res = await this.client.query(
      `SELECT id, game_id, state, host_player_id, join_code, is_private, max_players, created_at, updated_at 
       FROM rooms WHERE id = $1`,
      [roomId]
    );
    if (res.rows.length === 0) return null;
    return this.mapToRecord(res.rows[0]);
  }

  public async findByJoinCode(joinCode: string): Promise<RoomRecord | null> {
    const res = await this.client.query(
      `SELECT id, game_id, state, host_player_id, join_code, is_private, max_players, created_at, updated_at 
       FROM rooms WHERE join_code = $1`,
      [joinCode]
    );
    if (res.rows.length === 0) return null;
    return this.mapToRecord(res.rows[0]);
  }

  public async listActiveRooms(): Promise<RoomRecord[]> {
    const res = await this.client.query(
      `SELECT id, game_id, state, host_player_id, join_code, is_private, max_players, created_at, updated_at 
       FROM rooms WHERE state IN ('WAITING', 'STARTING', 'RUNNING')`
    );
    return res.rows.map(this.mapToRecord);
  }

  public async create(room: Omit<RoomRecord, 'createdAt' | 'updatedAt'>): Promise<void> {
    await this.client.query(
      `INSERT INTO rooms (id, game_id, state, host_player_id, join_code, is_private, max_players) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [room.id, room.gameId, room.state, room.hostPlayerId, room.joinCode, room.isPrivate, room.maxPlayers]
    );
  }

  public async update(roomId: string, updates: Partial<RoomRecord>): Promise<void> {
    const setFields: string[] = [];
    const values: any[] = [];
    let queryIndex = 1;

    // We also update updated_at automatically
    setFields.push(`updated_at = CURRENT_TIMESTAMP`);

    const fields = ['gameId', 'state', 'hostPlayerId', 'joinCode', 'isPrivate', 'maxPlayers'] as const;
    const dbCols = ['game_id', 'state', 'host_player_id', 'join_code', 'is_private', 'max_players'];

    fields.forEach((field, i) => {
      if (updates[field] !== undefined) {
        setFields.push(`${dbCols[i]} = $${queryIndex++}`);
        values.push(updates[field]);
      }
    });

    values.push(roomId);
    await this.client.query(
      `UPDATE rooms SET ${setFields.join(', ')} WHERE id = $${queryIndex}`,
      values
    );
  }

  public async delete(roomId: string): Promise<void> {
    await this.client.query('DELETE FROM rooms WHERE id = $1', [roomId]);
  }

  private mapToRecord(row: any): RoomRecord {
    return {
      id: row.id,
      gameId: row.game_id,
      state: row.state,
      hostPlayerId: row.host_player_id,
      joinCode: row.join_code,
      isPrivate: row.is_private,
      maxPlayers: row.max_players,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
