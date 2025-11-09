const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const jwt = require('jsonwebtoken');

// Middleware для проверки токена
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Требуется токен доступа' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-in-production');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Недействительный токен' });
  }
};

// Создание новой игры
router.post('/create', authenticateToken, async (req, res) => {
  try {
    console.log('📨 Create game request received:', req.body);
    
    const { title, gamemode, maxPlayers, totalRounds, isPrivate, password } = req.body;
    
    // Создаем новую игру
    const gameResult = await query(`
      INSERT INTO games (title, gamemode, hostid, maxplayers, totalrounds, isprivate, roompassword, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'waiting')
      RETURNING *
    `, [
      title || 'Игровая комната',
      gamemode || 'classic',
      req.user.userId,
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
    `, [newGame.gameid, req.user.userId, 1, true, 0, false]);

    console.log('✅ Host added to game players');
    
    res.status(201).json({
      message: 'Комната успешно создана',
      game: newGame
    });
  } catch (error) {
    console.error('❌ Error creating game:', error);
    
    if (error.code === '23505') {
      res.status(400).json({ error: 'Комната с таким названием уже существует' });
    } else if (error.code === '23503') {
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
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN g.status = 'finished' THEN 1 END) as completed_games,
        COUNT(CASE WHEN g.status = 'waiting' THEN 1 END) as waiting_games,
        COUNT(CASE WHEN g.status = 'playing' THEN 1 END) as active_games
      FROM games g
      WHERE g.hostid = $1
    `, [req.user.userId]);

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

// Получение данных комнаты
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    console.log('🔄 Fetching room data for:', roomId);
    

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

    const playersResult = await query(`
      SELECT gp.*, u.login, u.points 
      FROM game_players gp 
      LEFT JOIN users u ON gp.userid = u.userid 
      WHERE gp.gameid = $1 
      ORDER BY gp.playerorder
    `, [roomId]);

    console.log('✅ Room data fetched - players:', playersResult.rows.length);
    
    res.json({
      room: roomResult.rows[0],
      players: playersResult.rows
    });
  } catch (error) {
    console.error('❌ Error fetching room:', error);
    res.status(500).json({ error: 'Ошибка загрузки комнаты' });
  }
});

// Присоединение к комнате
router.post('/:roomId/join', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { password } = req.body || {};
    
    console.log('🔄 User joining room:', req.user.userId, 'to room:', roomId);

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
    `, [roomId, req.user.userId]);

    if (existingPlayer.rows.length > 0) {
      return res.status(400).json({ error: 'Вы уже в этой комнате' });
    }

    // Проверяем количество игроков
    if (room.currentplayers >= room.maxplayers) {
      return res.status(400).json({ error: 'Комната заполнена' });
    }

    // Определяем порядок игрока
    const playerOrder = room.currentplayers + 1;

    // Добавляем игрок
    await query(`
      INSERT INTO game_players (gameid, userid, playerorder, ishost, score, ready)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [roomId, req.user.userId, playerOrder, false, 0, false]);

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

// Выход из комнаты
router.post('/:roomId/leave', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    console.log('🔄 User leaving room:', req.user.userId, 'from room:', roomId);

    // Удаляем игрока
    const deleteResult = await query(`
      DELETE FROM game_players 
      WHERE gameid = $1 AND userid = $2 
      RETURNING *
    `, [roomId, req.user.userId]);

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Игрок не найден в комнате' });
    }

    // Обновляем счетчик игроков
    await query(`
      UPDATE games SET currentplayers = currentplayers - 1 WHERE gameid = $1
    `, [roomId]);

    console.log('✅ User left room successfully');
    res.json({ success: true, message: 'Вы вышли из комнаты' });
  } catch (error) {
    console.error('❌ Error leaving room:', error);
    res.status(500).json({ error: 'Ошибка выхода из комнаты' });
  }
});

// Изменение статуса готовности
router.post('/:roomId/ready', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    console.log('🔄 Toggling ready status for user:', req.user.userId, 'in room:', roomId);

    // Переключаем статус готовности
    const result = await query(`
      UPDATE game_players 
      SET ready = NOT ready 
      WHERE gameid = $1 AND userid = $2 
      RETURNING *
    `, [roomId, req.user.userId]);

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

// Начало игры
router.post('/:roomId/start', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    console.log('🔄 Starting game for room:', roomId, 'by user:', req.user.userId);

    // Проверяем, что пользователь - хост
    const hostCheck = await query(`
      SELECT ishost FROM game_players 
      WHERE gameid = $1 AND userid = $2 AND ishost = true
    `, [roomId, req.user.userId]);

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

    // Создаем первый раунд
    await query(`
      INSERT INTO rounds (gameid, roundnumber, status)
      VALUES ($1, 1, 'collecting_words')
    `, [roomId]);

    console.log('✅ Game started successfully');
    res.json({ success: true, message: 'Игра началась' });
  } catch (error) {
    console.error('❌ Error starting game:', error);
    res.status(500).json({ error: 'Ошибка начала игры' });
  }
});

// ✅ ПРОСТОЙ ЭНДПОИНТ ОТПРАВКИ СЛОВА
router.post('/:roomId/word', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { word } = req.body;
    const userId = req.user.userId;
    
    console.log('📝 СЛОВО - room:', roomId, 'user:', userId, 'word:', word);

    if (!word) {
      return res.status(400).json({ error: 'Слово обязательно' });
    }

    // Получаем комнату
    const roomResult = await query(`SELECT * FROM games WHERE gameid = $1`, [roomId]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const room = roomResult.rows[0];
    
    // Получаем или создаем раунд
    let roundResult = await query(`SELECT * FROM rounds WHERE gameid = $1 AND roundnumber = $2`, [roomId, room.currentround]);
    let roundId;

    if (roundResult.rows.length === 0) {
      // Создаем раунд
      const newRound = await query(`
        INSERT INTO rounds (gameid, roundnumber, status) 
        VALUES ($1, $2, 'collecting_words') 
        RETURNING roundid
      `, [roomId, room.currentround]);
      roundId = newRound.rows[0].roundid;
      console.log('✅ Создан новый раунд:', roundId);
    } else {
      roundId = roundResult.rows[0].roundid;
    }

    // Сохраняем слово
    await query(`
      INSERT INTO round_phrases (roundid, userid, phrase) 
      VALUES ($1, $2, $3)
      ON CONFLICT (roundid, userid) 
      DO UPDATE SET phrase = $3
    `, [roundId, userId, word]);

    console.log('✅ Слово сохранено!');

    res.json({
      success: true,
      message: 'Слово отправлено!',
      word: word
    });

  } catch (error) {
    console.error('❌ Ошибка отправки слова:', error);
    res.status(500).json({ error: 'Ошибка: ' + error.message });
  }
});

// ✅ ПРОСТОЙ ЭНДПОИНТ СТАТУСА СЛОВ
router.get('/:roomId/words-status', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    console.log('🔄 СТАТУС СЛОВ - room:', roomId);

    // Получаем текущий раунд
    const roomResult = await query(`SELECT currentround FROM games WHERE gameid = $1`, [roomId]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const currentRound = roomResult.rows[0].currentround;

    // Получаем roundid
    const roundResult = await query(`SELECT roundid FROM rounds WHERE gameid = $1 AND roundnumber = $2`, [roomId, currentRound]);
    let roundId = roundResult.rows.length > 0 ? roundResult.rows[0].roundid : null;

    // Получаем игроков
    const playersResult = await query(`
      SELECT gp.userid, u.login, gp.ready 
      FROM game_players gp
      LEFT JOIN users u ON gp.userid = u.userid
      WHERE gp.gameid = $1
      ORDER BY gp.playerorder
    `, [roomId]);

    // Получаем отправленные слова
    let submittedWords = [];
    if (roundId) {
      const wordsResult = await query(`SELECT userid, phrase FROM round_phrases WHERE roundid = $1`, [roundId]);
      submittedWords = wordsResult.rows;
    }

    // Формируем ответ
    const playersWithStatus = playersResult.rows.map(player => {
      const hasSubmitted = submittedWords.some(word => word.userid === player.userid);
      const userWord = submittedWords.find(word => word.userid === player.userid);
      
      return {
        userid: player.userid,
        login: player.login,
        hassubmittedword: hasSubmitted,
        submitted_word: userWord ? userWord.phrase : null,
        ready: player.ready
      };
    });

    const submittedCount = playersWithStatus.filter(p => p.hassubmittedword).length;
    const totalPlayers = playersWithStatus.length;

    console.log('✅ Статус слов:', submittedCount + '/' + totalPlayers);
    
    res.json({
      players: playersWithStatus,
      submittedCount: submittedCount,
      totalPlayers: totalPlayers,
      allSubmitted: submittedCount === totalPlayers && totalPlayers > 0,
      currentRound: currentRound
    });

  } catch (error) {
    console.error('❌ Ошибка получения статуса слов:', error);
    res.status(500).json({ error: 'Ошибка получения статуса слов' });
  }
});

// ✅ ПРОСТОЙ ЭНДПОИНТ ЗАПУСКА РИСОВАНИЯ
router.post('/:roomId/start-drawing', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    console.log('🎨 ЗАПУСК РИСОВАНИЯ - room:', roomId);

    // Проверяем, что пользователь - хост
    const hostCheck = await query(`SELECT ishost FROM game_players WHERE gameid = $1 AND userid = $2 AND ishost = true`, [roomId, req.user.userId]);
    if (hostCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Только хост может запустить этап рисования' });
    }

    // Получаем текущий раунд
    const roomResult = await query(`SELECT currentround FROM games WHERE gameid = $1`, [roomId]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const currentRound = roomResult.rows[0].currentround;

    // Получаем roundid
    const roundResult = await query(`SELECT roundid FROM rounds WHERE gameid = $1 AND roundnumber = $2`, [roomId, currentRound]);
    if (roundResult.rows.length === 0) {
      return res.status(400).json({ error: 'Раунд не найден' });
    }

    const roundId = roundResult.rows[0].roundid;

    // Проверяем что все отправили слова
    const wordsResult = await query(`SELECT COUNT(*) as count FROM round_phrases WHERE roundid = $1`, [roundId]);
    const playersResult = await query(`SELECT COUNT(*) as count FROM game_players WHERE gameid = $1`, [roomId]);

    if (wordsResult.rows[0].count < playersResult.rows[0].count) {
      return res.status(400).json({ error: 'Не все игроки отправили слова' });
    }

    // Создаем цепочку слов
    const allPlayers = await query(`SELECT userid, playerorder FROM game_players WHERE gameid = $1 ORDER BY playerorder`, [roomId]);
    const allWords = await query(`SELECT userid, phrase FROM round_phrases WHERE roundid = $1`, [roundId]);

    for (let i = 0; i < allPlayers.rows.length; i++) {
      const currentPlayer = allPlayers.rows[i];
      const prevIndex = (i - 1 + allPlayers.rows.length) % allPlayers.rows.length;
      const prevPlayer = allPlayers.rows[prevIndex];
      const prevWord = allWords.rows.find(w => w.userid === prevPlayer.userid);
      
      if (prevWord) {
        await query(`
          INSERT INTO round_chain (roundid, userid, actiontype, actiondata, actionorder)
          VALUES ($1, $2, 'drawing', $3, $4)
        `, [roundId, currentPlayer.userid, prevWord.phrase, i + 1]);
      }
    }

    // Обновляем статус раунда
    await query(`UPDATE rounds SET status = 'drawing' WHERE roundid = $1`, [roundId]);

    console.log('✅ Рисование запущено!');

    res.json({
      success: true,
      message: 'Этап рисования начат!'
    });

  } catch (error) {
    console.error('❌ Ошибка запуска рисования:', error);
    res.status(500).json({ error: 'Ошибка запуска рисования: ' + error.message });
  }
});

// ✅ ПРОСТОЙ ЭНДПОИНТ ПОЛУЧЕНИЯ СЛОВА ДЛЯ РИСОВАНИЯ
router.get('/:roomId/my-drawing-word', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;
    
    console.log('🔄 ПОЛУЧЕНИЕ СЛОВА ДЛЯ РИСОВАНИЯ - user:', userId);

    // Получаем текущий раунд
    const roomResult = await query(`SELECT currentround FROM games WHERE gameid = $1`, [roomId]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const currentRound = roomResult.rows[0].currentround;

    // Получаем roundid
    const roundResult = await query(`SELECT roundid FROM rounds WHERE gameid = $1 AND roundnumber = $2`, [roomId, currentRound]);
    if (roundResult.rows.length === 0) {
      return res.status(400).json({ error: 'Раунд не найден' });
    }

    const roundId = roundResult.rows[0].roundid;

    // Получаем слово для рисования
    const wordResult = await query(`SELECT actiondata as word FROM round_chain WHERE roundid = $1 AND userid = $2 AND actiontype = 'drawing'`, [roundId, userId]);

    if (wordResult.rows.length === 0) {
      return res.status(404).json({ error: 'Слово для рисования не найдено' });
    }

    const word = wordResult.rows[0].word;
    console.log('✅ Слово для рисования:', word);
    
    res.json({
      success: true,
      word: word
    });

  } catch (error) {
    console.error('❌ Ошибка получения слова:', error);
    res.status(500).json({ error: 'Ошибка получения слова' });
  }
});

// ✅ ПРОСТОЙ ЭНДПОИНТ СОХРАНЕНИЯ РИСУНКА
router.post('/:roomId/save-drawing', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { drawingData } = req.body;
    const userId = req.user.userId;
    
    console.log('🎨 СОХРАНЕНИЕ РИСУНКА - room:', roomId, 'user:', userId);

    if (!drawingData) {
      return res.status(400).json({ error: 'Нет данных рисунка' });
    }

    // Получаем текущий раунд
    const roomResult = await query(`SELECT currentround FROM games WHERE gameid = $1`, [roomId]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const currentRound = roomResult.rows[0].currentround;

    // Получаем roundid
    const roundResult = await query(`SELECT roundid FROM rounds WHERE gameid = $1 AND roundnumber = $2`, [roomId, currentRound]);
    if (roundResult.rows.length === 0) {
      return res.status(400).json({ error: 'Раунд не найден' });
    }

    const roundId = roundResult.rows[0].roundid;

    // Сохраняем рисунок
    await query(`
      INSERT INTO drawings (roundid, userid, drawingdata) 
      VALUES ($1, $2, $3)
      ON CONFLICT (roundid, userid) 
      DO UPDATE SET drawingdata = $3, createdat = NOW()
    `, [roundId, userId, drawingData]);

    console.log('✅ Рисунок сохранен!');

    res.json({
      success: true,
      message: 'Рисунок сохранен!'
    });

  } catch (error) {
    console.error('❌ Ошибка сохранения рисунка:', error);
    res.status(500).json({ error: 'Ошибка сохранения рисунка: ' + error.message });
  }
});

// ✅ ПРОСТОЙ ЭНДПОИНТ ЗАВЕРШЕНИЯ РИСОВАНИЯ
router.post('/:roomId/finish-drawing', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;
    
    console.log('✅ ЗАВЕРШЕНИЕ РИСОВАНИЯ - user:', userId);

    // Получаем текущий раунд
    const roomResult = await query(`SELECT currentround FROM games WHERE gameid = $1`, [roomId]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const currentRound = roomResult.rows[0].currentround;

    // Получаем roundid
    const roundResult = await query(`SELECT roundid FROM rounds WHERE gameid = $1 AND roundnumber = $2`, [roomId, currentRound]);
    if (roundResult.rows.length === 0) {
      return res.status(400).json({ error: 'Раунд не найден' });
    }

    const roundId = roundResult.rows[0].roundid;

    // Отмечаем завершение
    await query(`
      UPDATE round_chain 
      SET actiontype = 'drawing_completed' 
      WHERE roundid = $1 AND userid = $2 AND actiontype = 'drawing'
    `, [roundId, userId]);

    console.log('✅ Рисование завершено!');

    res.json({
      success: true,
      message: 'Рисование завершено!'
    });

  } catch (error) {
    console.error('❌ Ошибка завершения рисования:', error);
    res.status(500).json({ error: 'Ошибка завершения рисования: ' + error.message });
  }
});

// ✅ ПРОСТОЙ ЭНДПОИНТ СТАТУСА РИСОВАНИЯ
router.get('/:roomId/drawing-status', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    console.log('🔄 СТАТУС РИСОВАНИЯ - room:', roomId);

    // Получаем текущий раунд
    const roomResult = await query(`SELECT currentround FROM games WHERE gameid = $1`, [roomId]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const currentRound = roomResult.rows[0].currentround;

    // Получаем roundid
    const roundResult = await query(`SELECT roundid, status FROM rounds WHERE gameid = $1 AND roundnumber = $2`, [roomId, currentRound]);
    if (roundResult.rows.length === 0) {
      return res.status(400).json({ error: 'Раунд не найден' });
    }

    const roundId = roundResult.rows[0].roundid;
    const roundStatus = roundResult.rows[0].status;

    // Получаем статус игроков
    const statusResult = await query(`
      SELECT rc.userid, u.login, rc.actiontype as status, rc.actiondata as word
      FROM round_chain rc
      LEFT JOIN users u ON rc.userid = u.userid
      WHERE rc.roundid = $1 AND (rc.actiontype = 'drawing' OR rc.actiontype = 'drawing_completed')
      ORDER BY rc.actionorder
    `, [roundId]);

    const total = statusResult.rows.length;
    const completed = statusResult.rows.filter(p => p.status === 'drawing_completed').length;

    console.log('✅ Статус рисования:', completed + '/' + total);
    
    res.json({
      players: statusResult.rows,
      completedCount: completed,
      totalCount: total,
      allCompleted: completed === total && total > 0,
      roundStatus: roundStatus
    });

  } catch (error) {
    console.error('❌ Ошибка получения статуса:', error);
    res.status(500).json({ error: 'Ошибка получения статуса' });
  }
});

// ✅ ПРОСТОЙ ЭНДПОИНТ ПРИНУДИТЕЛЬНОГО ПЕРЕХОДА К УГАДЫВАНИЮ
router.post('/:roomId/force-guessing', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    console.log('🚀 ПРИНУДИТЕЛЬНЫЙ ПЕРЕХОД - room:', roomId);

    // Проверяем, что пользователь - хост
    const hostCheck = await query(`SELECT ishost FROM game_players WHERE gameid = $1 AND userid = $2 AND ishost = true`, [roomId, req.user.userId]);
    if (hostCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Только хост может перейти к угадыванию' });
    }

    // Получаем текущий раунд
    const roomResult = await query(`SELECT currentround FROM games WHERE gameid = $1`, [roomId]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const currentRound = roomResult.rows[0].currentround;

    // Получаем roundid
    const roundResult = await query(`SELECT roundid FROM rounds WHERE gameid = $1 AND roundnumber = $2`, [roomId, currentRound]);
    if (roundResult.rows.length === 0) {
      return res.status(400).json({ error: 'Раунд не найден' });
    }

    const roundId = roundResult.rows[0].roundid;

    // Обновляем статус раунда
    await query(`UPDATE rounds SET status = 'guessing' WHERE roundid = $1`, [roundId]);

    console.log('✅ Переход к угадыванию!');

    res.json({
      success: true,
      message: 'Этап угадывания запущен!'
    });

  } catch (error) {
    console.error('❌ Ошибка перехода:', error);
    res.status(500).json({ error: 'Ошибка перехода: ' + error.message });
  }
});

module.exports = router;