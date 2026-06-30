export class GameRepository {
    client;
    constructor(client) {
        this.client = client;
    }
    async findById(gameId) {
        const res = await this.client.query('SELECT id, map_config_id, created_at, finished_at, winner_id FROM games WHERE id = $1', [gameId]);
        if (res.rows.length === 0)
            return null;
        return this.mapToRecord(res.rows[0]);
    }
    async create(game) {
        await this.client.query(`INSERT INTO games (id, map_config_id, finished_at, winner_id) 
       VALUES ($1, $2, $3, $4)`, [game.id, game.mapConfigId, game.finishedAt, game.winnerId]);
    }
    async update(gameId, updates) {
        const setFields = [];
        const values = [];
        let queryIndex = 1;
        if (updates.finishedAt !== undefined) {
            setFields.push(`finished_at = $${queryIndex++}`);
            values.push(updates.finishedAt);
        }
        if (updates.winnerId !== undefined) {
            setFields.push(`winner_id = $${queryIndex++}`);
            values.push(updates.winnerId);
        }
        if (setFields.length === 0)
            return;
        values.push(gameId);
        await this.client.query(`UPDATE games SET ${setFields.join(', ')} WHERE id = $${queryIndex}`, values);
    }
    mapToRecord(row) {
        return {
            id: row.id,
            mapConfigId: row.map_config_id,
            createdAt: row.created_at,
            finishedAt: row.finished_at,
            winnerId: row.winner_id,
        };
    }
}
//# sourceMappingURL=GameRepository.js.map