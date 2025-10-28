const { query } = require('../config/database');

const Game = {
  create: async (winnerUserId = null) => {
    const result = await query(
      'INSERT INTO Games (WinnerUserID) VALUES ($1) RETURNING *',
      [winnerUserId]
    );
    return result.rows[0];
  },

  getById: async (gameId) => {
    const result = await query(
      'SELECT g.*, u.Login as WinnerName FROM Games g LEFT JOIN Users u ON g.WinnerUserID = u.UserID WHERE g.GameID = $1',
      [gameId]
    );
    return result.rows[0];
  },

  setWinner: async (gameId, winnerUserId) => {
    const result = await query(
      'UPDATE Games SET WinnerUserID = $1 WHERE GameID = $2 RETURNING *',
      [winnerUserId, gameId]
    );
    return result.rows[0];
  },

  getGameHistory: async (limit = 20) => {
    const result = await query(
      `SELECT g.GameID, g.GameDate, g.WinnerUserID, u.Login as WinnerName 
       FROM Games g 
       LEFT JOIN Users u ON g.WinnerUserID = u.UserID 
       ORDER BY g.GameDate DESC 
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }
};

module.exports = Game;