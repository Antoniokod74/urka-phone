const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const jwt = require('jsonwebtoken');

// Создание новой игры
router.post('/create', async (req, res) => {
  try {
    console.log('📨 Create game request received:', req.body);
    
    const { title, gamemode, maxPlayers, totalRounds, isPrivate, password } = req.body;
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    
    if (!token) {
      return res.status(401).json({ error: 'Требуется токен доступа' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-in-production');
    console.log('🔄 Creating room for user:', decoded.userId);

    // Создаем новую игру
    const gameResult = await query(`
      INSERT INTO games (title, gamemode, hostid, maxplayers, totalrounds, isprivate, roompassword, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'waiting')
      RETURNING *
    `, [
      title || 'Игровая комната',
      gamemode || 'classic',
      decoded.userId,
      maxPlayers || 8,
      totalRounds || 3,
      isPrivate || false,
      password || null
    ]);

    const newGame = gameResult.rows[0];
    console.log('✅ Game created with ID:', newGame.gameid);

    // Добавляем хоста в игроки
    await query(`
      INSERT INTO game_players (gameid, userid, playerorder, ishost, score, ready)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [newGame.gameid, decoded.userId, 1, true, 0, false]);

    console.log('✅ Host added to game players');
    
    res.status(201).json({
      message: 'Комната успешно создана',
      game: newGame
    });
  } catch (error) {
    console.error('❌ Error creating game:', error);
    
    if (error.code === '23505') { // unique violation
      res.status(400).json({ error: 'Комната с таким названием уже существует' });
    } else if (error.code === '23503') { // foreign key violation
      res.status(400).json({ error: 'Пользователь не найден' });
    } else {
      res.status(500).json({ error: 'Ошибка создания комнаты: ' + error.message });
    }
  }
});

// Получить активные комнаты
router.get('/active-rooms', async (req, res) => {
  try {
    console.log('🔄 Fetching active rooms');
    
    const result = await query(`
      SELECT 
        g.gameid,
        g.title,
        g.gamemode,
        g.maxplayers,
        g.currentplayers,
        g.isprivate,
        g.status,
        g.currentround,
        g.totalrounds,
        g.createdat,
        u.login as hostname,
        COUNT(gp.userid) as players_count
      FROM games g
      LEFT JOIN users u ON g.hostid = u.userid
      LEFT JOIN game_players gp ON g.gameid = gp.gameid
      WHERE g.status IN ('waiting', 'playing')
      GROUP BY g.gameid, u.login
      ORDER BY g.createdat DESC
      LIMIT 20
    `);

    console.log('✅ Active rooms fetched:', result.rows.length);
    res.json({
      rooms: result.rows
    });
  } catch (error) {
    console.error('❌ Error fetching active rooms:', error);
    res.status(500).json({ error: 'Ошибка при загрузке комнат' });
  }
});

// Получить историю игр
router.get('/history', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        g.gameid,
        g.title,
        g.gamemode,
        g.status,
        g.currentplayers,
        g.maxplayers,
        g.createdat,
        g.totalrounds,
        u.login as hostname
      FROM games g
      LEFT JOIN users u ON g.hostid = u.userid
      WHERE g.status = 'finished'
      ORDER BY g.createdat DESC 
      LIMIT 20
    `);

    res.json({
      games: result.rows
    });
  } catch (error) {
    console.error('Error fetching game history:', error);
    res.status(500).json({ error: 'Ошибка загрузки истории игр' });
  }
});

// Получить статистику игр
router.get('/stats', async (req, res) => {
  try {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    
    if (!token) {
      return res.status(401).json({ error: 'Требуется токен доступа' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-in-production');

    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN g.status = 'finished' THEN 1 END) as completed_games,
        COUNT(CASE WHEN g.status = 'waiting' THEN 1 END) as waiting_games,
        COUNT(CASE WHEN g.status = 'playing' THEN 1 END) as active_games
      FROM games g
      WHERE g.hostid = $1
    `, [decoded.userId]);

    res.json({
      stats: statsResult.rows[0] || { 
        total_games: 0, 
        completed_games: 0, 
        waiting_games: 0, 
        active_games: 0 
      }
    });
  } catch (error) {
    console.error('Error fetching game stats:', error);
    res.status(500).json({ error: 'Ошибка загрузки статистики' });
  }
});

// Получение данных комнаты - ИСПРАВЛЕННЫЙ ЭНДПОИНТ
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    console.log('🔄 Fetching room data for:', roomId);
    
    // Находим комнату
    const roomResult = await query(`
      SELECT g.*, u.login as hostname 
      FROM games g 
      LEFT JOIN users u ON g.hostid = u.userid 
      WHERE g.gameid = $1
    `, [roomId]);

    if (roomResult.rows.length === 0) {
      console.log('❌ Room not found:', roomId);
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    // Находим игроков в комнате
    const playersResult = await query(`
      SELECT gp.*, u.login, u.points 
      FROM game_players gp 
      LEFT JOIN users u ON gp.userid = u.userid 
      WHERE gp.gameid = $1 
      ORDER BY gp.playerorder
    `, [roomId]);

    console.log('✅ Room data fetched successfully');
    res.json({
      room: roomResult.rows[0],
      players: playersResult.rows
    });
  } catch (error) {
    console.error('❌ Error fetching room:', error);
    res.status(500).json({ error: 'Ошибка загрузки комнаты' });
  }
});

// Присоединение к комнате - ИСПРАВЛЕННЫЙ ЭНДПОИНТ
router.post('/:roomId/join', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { password } = req.body || {};
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    
    if (!token) {
      return res.status(401).json({ error: 'Требуется токен доступа' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-in-production');
    console.log('🔄 User joining room:', decoded.userId, 'to room:', roomId);

    // Проверяем существование комнаты
    const roomResult = await query(`
      SELECT * FROM games WHERE gameid = $1 AND status = 'waiting'
    `, [roomId]);

    if (roomResult.rows.length === 0) {
      console.log('❌ Room not found or not waiting:', roomId);
      return res.status(404).json({ error: 'Комната не найдена или игра уже началась' });
    }

    const room = roomResult.rows[0];

    // Проверяем пароль для приватной комнаты
    if (room.isprivate) {
      if (!password) {
        return res.status(403).json({ error: 'Для приватной комнаты требуется пароль' });
      }
      if (room.roompassword !== password) {
        return res.status(403).json({ error: 'Неверный пароль комнаты' });
      }
    }

    // Проверяем, не присоединился ли уже пользователь
    const existingPlayer = await query(`
      SELECT * FROM game_players WHERE gameid = $1 AND userid = $2
    `, [roomId, decoded.userId]);

    if (existingPlayer.rows.length > 0) {
      return res.status(400).json({ error: 'Вы уже в этой комнате' });
    }

    // Проверяем количество игроков
    if (room.currentplayers >= room.maxplayers) {
      return res.status(400).json({ error: 'Комната заполнена' });
    }

    // Определяем порядок игрока
    const playerOrder = room.currentplayers + 1;

    // Добавляем игрока
    await query(`
      INSERT INTO game_players (gameid, userid, playerorder, ishost, score, ready)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [roomId, decoded.userId, playerOrder, false, 0, false]);

    // Обновляем счетчик игроков
    await query(`
      UPDATE games SET currentplayers = currentplayers + 1 WHERE gameid = $1
    `, [roomId]);

    console.log('✅ User joined room successfully');
    res.json({
      success: true,
      message: 'Вы присоединились к комнате'
    });
  } catch (error) {
    console.error('❌ Error joining room:', error);
    res.status(500).json({ error: 'Ошибка присоединения к комнате' });
  }
});

// Изменение статуса готовности - ИСПРАВЛЕННЫЙ ЭНДПОИНТ
router.post('/:roomId/ready', async (req, res) => {
  try {
    const { roomId } = req.params;
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    
    if (!token) {
      return res.status(401).json({ error: 'Требуется токен доступа' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-in-production');
    console.log('🔄 Toggling ready status for user:', decoded.userId, 'in room:', roomId);

    // Переключаем статус готовности
    const result = await query(`
      UPDATE game_players 
      SET ready = NOT ready 
      WHERE gameid = $1 AND userid = $2 
      RETURNING *
    `, [roomId, decoded.userId]);

    if (result.rows.length === 0) {
      console.log('❌ Player not found in room');
      return res.status(404).json({ error: 'Игрок не найден в комнате' });
    }

    console.log('✅ Ready status toggled');
    res.json({ success: true, ready: result.rows[0].ready });
  } catch (error) {
    console.error('❌ Error updating ready status:', error);
    res.status(500).json({ error: 'Ошибка изменения статуса' });
  }
});

// Начало игры - ИСПРАВЛЕННЫЙ ЭНДПОИНТ
router.post('/:roomId/start', async (req, res) => {
  try {
    const { roomId } = req.params;
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    
    if (!token) {
      return res.status(401).json({ error: 'Требуется токен доступа' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-in-production');
    console.log('🔄 Starting game for room:', roomId, 'by user:', decoded.userId);

    // Проверяем, что пользователь - хост
    const hostCheck = await query(`
      SELECT ishost FROM game_players 
      WHERE gameid = $1 AND userid = $2 AND ishost = true
    `, [roomId, decoded.userId]);

    if (hostCheck.rows.length === 0) {
      console.log('❌ User is not host');
      return res.status(403).json({ error: 'Только хост может начать игру' });
    }

    // Проверяем, что все игроки готовы
    const playersResult = await query(`
      SELECT COUNT(*) as total, 
             COUNT(CASE WHEN ready = true THEN 1 END) as ready_count 
      FROM game_players 
      WHERE gameid = $1
    `, [roomId]);

    const { total, ready_count } = playersResult.rows[0];

    if (ready_count < total) {
      return res.status(400).json({ 
        error: 'Не все игроки готовы', 
        ready: ready_count, 
        total: total 
      });
    }

    // Обновляем статус комнаты
    await query(`
      UPDATE games 
      SET status = 'playing', currentround = 1 
      WHERE gameid = $1
    `, [roomId]);

    console.log('✅ Game started successfully');
    res.json({ success: true, message: 'Игра началась' });
  } catch (error) {
    console.error('❌ Error starting game:', error);
    res.status(500).json({ error: 'Ошибка начала игры' });
  }
});

module.exports = router;