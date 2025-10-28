const { query } = require('../config/database');

const Move = {
  // Создать ход
  create: async (roundId, userId, moveType, moveData, moveOrder) => {
    const result = await query(
      'INSERT INTO Moves (RoundID, UserID, MoveType, MoveData, MoveOrder) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [roundId, userId, moveType, moveData, moveOrder]
    );
    return result.rows[0];
  },

  // Получить ходы раунда
  getByRoundId: async (roundId) => {
    const result = await query(
      `SELECT m.*, u.Login as UserName 
       FROM Moves m 
       JOIN Users u ON m.UserID = u.UserID 
       WHERE m.RoundID = $1 
       ORDER BY m.MoveOrder`,
      [roundId]
    );
    return result.rows;
  }
};

module.exports = Move;