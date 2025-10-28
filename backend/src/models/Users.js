const { query } = require('../config/database');
const bcrypt = require('bcrypt');

const User = {
  register: async (login, password) => {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO Users (Login, PasswordHash) VALUES ($1, $2) RETURNING UserID, Login, GamesPlayed, GamesWon, Points',
      [login, hashedPassword]
    );
    return result.rows[0];
  },

  login: async (login, password) => {
    const result = await query('SELECT * FROM Users WHERE Login = $1', [login]);
    if (result.rows.length === 0) return null;
    
    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.passwordhash);
    return isValidPassword ? user : null;
  },

  getById: async (userId) => {
    const result = await query(
      'SELECT UserID, Login, GamesPlayed, GamesWon, Points FROM Users WHERE UserID = $1',
      [userId]
    );
    return result.rows[0];
  },

  updateStats: async (userId, gamesPlayed, gamesWon, points) => {
    const result = await query(
      'UPDATE Users SET GamesPlayed = GamesPlayed + $1, GamesWon = GamesWon + $2, Points = Points + $3 WHERE UserID = $4 RETURNING *',
      [gamesPlayed, gamesWon, points, userId]
    );
    return result.rows[0];
  },

  getTopPlayers: async (limit = 10) => {
    const result = await query(
      'SELECT UserID, Login, GamesPlayed, GamesWon, Points FROM Users ORDER BY Points DESC LIMIT $1',
      [limit]
    );
    return result.rows;
  }
};

module.exports = User;