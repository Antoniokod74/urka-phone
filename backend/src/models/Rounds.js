const { query } = require('../config/database');

const Round = {
  // Создать раунд
  create: async (gameId, roundNumber) => {
    const result = await query(
      'INSERT INTO Rounds (GameID, RoundNumber) VALUES ($1, $2) RETURNING *',
      [gameId, roundNumber]
    );
    return result.rows[0];
  },

  // Получить раунды игры
  getByGameId: async (gameId) => {
    const result = await query(
      'SELECT * FROM Rounds WHERE GameID = $1 ORDER BY RoundNumber',
      [gameId]
    );
    return result.rows;
  }
};

module.exports = Round;