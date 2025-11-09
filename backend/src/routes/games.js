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

// ✅ ИСПРАВЛЕНО: Отправка слова
router.post('/:roomId/word', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { word } = req.body;
    const userId = req.user.userId;
    
    console.log('📝 Получено слово для комнаты:', roomId, 'от пользователя:', userId, 'слово:', word);

    // Проверяем существование комнаты и получаем текущий раунд
    const roomResult = await query(`
      SELECT * FROM games WHERE gameid = $1 AND status = 'playing'
    `, [roomId]);

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена или игра не начата' });
    }

    const room = roomResult.rows[0];
    const currentRound = room.currentround;

    // Проверяем что пользователь в комнате
    const playerResult = await query(`
      SELECT * FROM game_players WHERE gameid = $1 AND userid = $2
    `, [roomId, userId]);

    if (playerResult.rows.length === 0) {
      return res.status(403).json({ error: 'Вы не в этой комнате' });
    }

    // Получаем roundid для текущего раунда
    const roundResult = await query(`
      SELECT roundid FROM rounds 
      WHERE gameid = $1 AND roundnumber = $2
    `, [roomId, currentRound]);

    if (roundResult.rows.length === 0) {
      return res.status(400).json({ error: 'Раунд не найден' });
    }

    const roundId = roundResult.rows[0].roundid;

    // Проверяем, не отправил ли уже пользователь слово в этом раунде
    const existingPhrase = await query(`
      SELECT * FROM round_phrases 
      WHERE roundid = $1 AND userid = $2
    `, [roundId, userId]);

    if (existingPhrase.rows.length > 0) {
      return res.status(400).json({ error: 'Вы уже отправили слово в этом раунде' });
    }

    // ✅ СОХРАНЯЕМ СЛОВО В ТАБЛИЦУ round_phrases
    const phraseResult = await query(`
      INSERT INTO round_phrases (roundid, userid, phrase)
      VALUES ($1, $2, $3)
      RETURNING phraseid
    `, [roundId, userId, word]);

    console.log('✅ Слово сохранено в round_phrases с ID:', phraseResult.rows[0].phraseid);
    
    res.json({
      success: true,
      message: 'Слово успешно отправлено',
      word: word,
      roundId: roundId
    });

  } catch (error) {
    console.error('❌ Ошибка сохранения слова:', error);
    res.status(500).json({ error: 'Ошибка сохранения слова: ' + error.message });
  }
});

// ✅ ИСПРАВЛЕНО: Получение статуса слов
router.get('/:roomId/words-status', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    console.log('🔄 Получаем статус слов для комнаты:', roomId);

    // Получаем текущий раунд комнаты
    const roomResult = await query(`
      SELECT currentround FROM games WHERE gameid = $1
    `, [roomId]);

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const currentRound = roomResult.rows[0].currentround;

    // Получаем roundid для текущего раунда
    const roundResult = await query(`
      SELECT roundid FROM rounds 
      WHERE gameid = $1 AND roundnumber = $2
    `, [roomId, currentRound]);

    let roundId = null;
    if (roundResult.rows.length > 0) {
      roundId = roundResult.rows[0].roundid;
    }

    // Получаем всех игроков комнаты
    const playersResult = await query(`
      SELECT 
        gp.userid,
        u.login,
        gp.ready
      FROM game_players gp
      LEFT JOIN users u ON gp.userid = u.userid
      WHERE gp.gameid = $1
      ORDER BY gp.playerorder
    `, [roomId]);

    // Получаем отправленные слова для текущего раунда
    let submittedWords = [];
    if (roundId) {
      const wordsResult = await query(`
        SELECT userid, phrase 
        FROM round_phrases 
        WHERE roundid = $1
      `, [roundId]);
      
      submittedWords = wordsResult.rows;
    }

    // Формируем ответ с информацией о статусе отправки слов
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
      currentRound: currentRound,
      roundId: roundId
    });

  } catch (error) {
    console.error('❌ Ошибка получения статуса слов:', error);
    res.status(500).json({ error: 'Ошибка получения статуса слов' });
  }
});

// ✅ ДОБАВЛЕНО: Запуск этапа рисования (когда все слова собраны)
router.post('/:roomId/start-drawing', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    console.log('🎨 Запуск этапа рисования для комнаты:', roomId);

    // Проверяем, что пользователь - хост
    const hostCheck = await query(`
      SELECT ishost FROM game_players 
      WHERE gameid = $1 AND userid = $2 AND ishost = true
    `, [roomId, req.user.userId]);

    if (hostCheck.rows.length === 0) {
      console.log('❌ User is not host');
      return res.status(403).json({ error: 'Только хост может запустить этап рисования' });
    }

    // Получаем текущий раунд
    const roomResult = await query(`
      SELECT currentround FROM games WHERE gameid = $1
    `, [roomId]);

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const currentRound = roomResult.rows[0].currentround;

    // Получаем roundid
    const roundResult = await query(`
      SELECT roundid FROM rounds 
      WHERE gameid = $1 AND roundnumber = $2
    `, [roomId, currentRound]);

    if (roundResult.rows.length === 0) {
      return res.status(400).json({ error: 'Раунд не найден' });
    }

    const roundId = roundResult.rows[0].roundid;

    // Проверяем что все игроки отправили слова
    const wordsResult = await query(`
      SELECT COUNT(*) as submitted_count 
      FROM round_phrases 
      WHERE roundid = $1
    `, [roundId]);

    const playersResult = await query(`
      SELECT COUNT(*) as total_players 
      FROM game_players 
      WHERE gameid = $1
    `, [roomId]);

    const submittedCount = wordsResult.rows[0].submitted_count;
    const totalPlayers = playersResult.rows[0].total_players;

    if (submittedCount < totalPlayers) {
      return res.status(400).json({ 
        error: 'Не все игроки отправили слова', 
        submitted: submittedCount, 
        total: totalPlayers 
      });
    }

    // ✅ СОЗДАЕМ ЦЕПОЧКУ СЛОВ ДЛЯ РИСОВАНИЯ
    // Получаем всех игроков в порядке их playerorder
    const allPlayers = await query(`
      SELECT userid, playerorder 
      FROM game_players 
      WHERE gameid = $1 
      ORDER BY playerorder
    `, [roomId]);

    // Получаем все слова
    const allWords = await query(`
      SELECT userid, phrase 
      FROM round_phrases 
      WHERE roundid = $1
    `, [roundId]);

    // Создаем цепочку: каждый игрок получает слово предыдущего игрока
    for (let i = 0; i < allPlayers.rows.length; i++) {
      const currentPlayer = allPlayers.rows[i];
      const previousPlayerIndex = (i - 1 + allPlayers.rows.length) % allPlayers.rows.length;
      const previousPlayer = allPlayers.rows[previousPlayerIndex];
      
      // Находим слово предыдущего игрока
      const previousPlayerWord = allWords.rows.find(w => w.userid === previousPlayer.userid);
      
      if (previousPlayerWord) {
        // Сохраняем в round_chain
        await query(`
          INSERT INTO round_chain (roundid, userid, actiontype, actiondata, actionorder)
          VALUES ($1, $2, 'drawing', $3, $4)
        `, [roundId, currentPlayer.userid, previousPlayerWord.phrase, i + 1]);
      }
    }

    // Обновляем статус раунда
    await query(`
      UPDATE rounds SET status = 'drawing' WHERE roundid = $1
    `, [roundId]);

    console.log('✅ Цепочка слов создана, этап рисования начат');

    res.json({
      success: true,
      message: 'Этап рисования начат',
      roundId: roundId
    });

  } catch (error) {
    console.error('❌ Ошибка запуска этапа рисования:', error);
    res.status(500).json({ error: 'Ошибка запуска этапа рисования: ' + error.message });
  }
});

// ✅ ДОБАВЛЕНО: Получение слова для рисования текущим игроком
router.get('/:roomId/my-drawing-word', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;
    
    console.log('🔄 Получение слова для рисования пользователем:', userId);

    // Получаем текущий раунд
    const roomResult = await query(`
      SELECT currentround FROM games WHERE gameid = $1
    `, [roomId]);

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const currentRound = roomResult.rows[0].currentround;

    // Получаем roundid
    const roundResult = await query(`
      SELECT roundid FROM rounds 
      WHERE gameid = $1 AND roundnumber = $2
    `, [roomId, currentRound]);

    if (roundResult.rows.length === 0) {
      return res.status(400).json({ error: 'Раунд не найден' });
    }

    const roundId = roundResult.rows[0].roundid;

    // Получаем слово для рисования из round_chain
    const drawingWordResult = await query(`
      SELECT actiondata as word 
      FROM round_chain 
      WHERE roundid = $1 AND userid = $2 AND actiontype = 'drawing'
    `, [roundId, userId]);

    if (drawingWordResult.rows.length === 0) {
      return res.status(404).json({ error: 'Слово для рисования не найдено' });
    }

    const word = drawingWordResult.rows[0].word;

    console.log('✅ Слово для рисования получено:', word);
    
    res.json({
      success: true,
      word: word
    });

  } catch (error) {
    console.error('❌ Ошибка получения слова для рисования:', error);
    res.status(500).json({ error: 'Ошибка получения слова для рисования' });
  }
});

// ✅ ДОБАВЛЕНО: Сохранение рисунка
router.post('/:roomId/save-drawing', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { drawingData } = req.body;
    const userId = req.user.userId;
    
    console.log('🎨 Сохранение рисунка для комнаты:', roomId, 'пользователь:', userId);

    // Получаем текущий раунд
    const roomResult = await query(`
      SELECT currentround FROM games WHERE gameid = $1
    `, [roomId]);

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const currentRound = roomResult.rows[0].currentround;

    // Получаем roundid
    const roundResult = await query(`
      SELECT roundid FROM rounds 
      WHERE gameid = $1 AND roundnumber = $2
    `, [roomId, currentRound]);

    if (roundResult.rows.length === 0) {
      return res.status(400).json({ error: 'Раунд не найден' });
    }

    const roundId = roundResult.rows[0].roundid;

    // Проверяем, не сохранил ли уже пользователь рисунок
    const existingDrawing = await query(`
      SELECT * FROM drawings 
      WHERE roundid = $1 AND userid = $2
    `, [roundId, userId]);

    if (existingDrawing.rows.length > 0) {
      // Обновляем существующий рисунок
      await query(`
        UPDATE drawings SET drawingdata = $3, createdat = NOW() 
        WHERE roundid = $1 AND userid = $2
      `, [roundId, userId, drawingData]);
    } else {
      // Сохраняем новый рисунок
      await query(`
        INSERT INTO drawings (roundid, userid, drawingdata)
        VALUES ($1, $2, $3)
      `, [roundId, userId, drawingData]);
    }

    console.log('✅ Рисунок сохранен');

    res.json({
      success: true,
      message: 'Рисунок сохранен'
    });

  } catch (error) {
    console.error('❌ Ошибка сохранения рисунка:', error);
    res.status(500).json({ error: 'Ошибка сохранения рисунка: ' + error.message });
  }
});

// ✅ ДОБАВЛЕНО: Завершение рисунка
router.post('/:roomId/finish-drawing', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;
    
    console.log('✅ Завершение рисунка пользователем:', userId, 'в комнате:', roomId);

    // Получаем текущий раунд
    const roomResult = await query(`
      SELECT currentround FROM games WHERE gameid = $1
    `, [roomId]);

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const currentRound = roomResult.rows[0].currentround;

    // Получаем roundid
    const roundResult = await query(`
      SELECT roundid FROM rounds 
      WHERE gameid = $1 AND roundnumber = $2
    `, [roomId, currentRound]);

    if (roundResult.rows.length === 0) {
      return res.status(400).json({ error: 'Раунд не найден' });
    }

    const roundId = roundResult.rows[0].roundid;

    // Отмечаем что пользователь завершил рисование в round_chain
    await query(`
      UPDATE round_chain 
      SET actiontype = 'drawing_completed' 
      WHERE roundid = $1 AND userid = $2 AND actiontype = 'drawing'
    `, [roundId, userId]);

    console.log('✅ Рисование завершено пользователем:', userId);

    // Проверяем, все ли завершили рисование
    const drawingStatusResult = await query(`
      SELECT 
        COUNT(*) as total_artists,
        COUNT(CASE WHEN actiontype = 'drawing_completed' THEN 1 END) as completed_artists
      FROM round_chain 
      WHERE roundid = $1 AND (actiontype = 'drawing' OR actiontype = 'drawing_completed')
    `, [roundId]);

    const { total_artists, completed_artists } = drawingStatusResult.rows[0];

    console.log(`🎨 Статус рисования: ${completed_artists}/${total_artists}`);

    // Если все завершили рисование, автоматически запускаем этап угадывания
    if (completed_artists === total_artists && total_artists > 0) {
      console.log('🚀 Все завершили рисование, запускаем этап угадывания');
      
      // Обновляем статус раунда
      await query(`
        UPDATE rounds SET status = 'guessing' WHERE roundid = $1
      `, [roundId]);

      // Создаем записи для угадываний
      const artistsResult = await query(`
        SELECT userid FROM round_chain 
        WHERE roundid = $1 AND actiontype = 'drawing_completed'
      `, [roundId]);

      for (const artist of artistsResult.rows) {
        // Каждый художник становится объектом для угадывания
        await query(`
          INSERT INTO round_chain (roundid, userid, actiontype, actiondata, actionorder)
          VALUES ($1, $2, 'guess_target', 'drawing', 10)
        `, [roundId, artist.userid]);
      }
    }

    res.json({
      success: true,
      message: 'Рисование завершено',
      allCompleted: completed_artists === total_artists
    });

  } catch (error) {
    console.error('❌ Ошибка завершения рисунка:', error);
    res.status(500).json({ error: 'Ошибка завершения рисунка: ' + error.message });
  }
});

// ✅ ДОБАВЛЕНО: Получение статуса рисования
router.get('/:roomId/drawing-status', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    console.log('🔄 Получение статуса рисования для комнаты:', roomId);

    // Получаем текущий раунд
    const roomResult = await query(`
      SELECT currentround FROM games WHERE gameid = $1
    `, [roomId]);

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const currentRound = roomResult.rows[0].currentround;

    // Получаем roundid
    const roundResult = await query(`
      SELECT roundid, status FROM rounds 
      WHERE gameid = $1 AND roundnumber = $2
    `, [roomId, currentRound]);

    if (roundResult.rows.length === 0) {
      return res.status(400).json({ error: 'Раунд не найден' });
    }

    const roundId = roundResult.rows[0].roundid;
    const roundStatus = roundResult.rows[0].status;

    // Получаем статус рисования всех игроков
    const drawingStatusResult = await query(`
      SELECT 
        rc.userid,
        u.login,
        rc.actiontype as status,
        rc.actiondata as word,
        CASE 
          WHEN d.drawingdata IS NOT NULL THEN true 
          ELSE false 
        END as has_drawing
      FROM round_chain rc
      LEFT JOIN users u ON rc.userid = u.userid
      LEFT JOIN drawings d ON rc.roundid = d.roundid AND rc.userid = d.userid
      WHERE rc.roundid = $1 AND (rc.actiontype = 'drawing' OR rc.actiontype = 'drawing_completed')
      ORDER BY rc.actionorder
    `, [roundId]);

    const totalArtists = drawingStatusResult.rows.length;
    const completedArtists = drawingStatusResult.rows.filter(p => p.status === 'drawing_completed').length;

    console.log('✅ Статус рисования:', completedArtists + '/' + totalArtists);
    
    res.json({
      players: drawingStatusResult.rows,
      completedCount: completedArtists,
      totalCount: totalArtists,
      allCompleted: completedArtists === totalArtists && totalArtists > 0,
      roundStatus: roundStatus,
      currentRound: currentRound
    });

  } catch (error) {
    console.error('❌ Ошибка получения статуса рисования:', error);
    res.status(500).json({ error: 'Ошибка получения статуса рисования' });
  }
});

// ✅ ДОБАВЛЕНО: Получение рисунков для угадывания
router.get('/:roomId/drawings-to-guess', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;
    
    console.log('🔄 Получение рисунков для угадывания пользователем:', userId);

    // Получаем текущий раунд
    const roomResult = await query(`
      SELECT currentround FROM games WHERE gameid = $1
    `, [roomId]);

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const currentRound = roomResult.rows[0].currentround;

    // Получаем roundid
    const roundResult = await query(`
      SELECT roundid, status FROM rounds 
      WHERE gameid = $1 AND roundnumber = $2
    `, [roomId, currentRound]);

    if (roundResult.rows.length === 0) {
      return res.status(400).json({ error: 'Раунд не найден' });
    }

    const roundId = roundResult.rows[0].roundid;

    // Получаем все рисунки кроме своего
    const drawingsResult = await query(`
      SELECT 
        d.userid,
        u.login,
        d.drawingdata,
        rc.actiondata as original_word,
        EXISTS(
          SELECT 1 FROM guesses g 
          WHERE g.roundid = $1 AND g.userid = $2 AND g.guess_for_userid = d.userid
        ) as already_guessed
      FROM drawings d
      LEFT JOIN users u ON d.userid = u.userid
      LEFT JOIN round_chain rc ON d.roundid = rc.roundid AND d.userid = rc.userid AND rc.actiontype = 'drawing'
      WHERE d.roundid = $1 AND d.userid != $2
      ORDER BY d.createdat
    `, [roundId, userId]);

    console.log('✅ Найдено рисунков для угадывания:', drawingsResult.rows.length);
    
    res.json({
      success: true,
      drawings: drawingsResult.rows,
      totalDrawings: drawingsResult.rows.length
    });

  } catch (error) {
    console.error('❌ Ошибка получения рисунков для угадывания:', error);
    res.status(500).json({ error: 'Ошибка получения рисунков для угадывания' });
  }
});

// ✅ ДОБАВЛЕНО: Отправка догадки
router.post('/:roomId/guess', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { guess, artistUserId } = req.body;
    const userId = req.user.userId;
    
    console.log('💭 Отправка догадки:', guess, 'для художника:', artistUserId, 'от пользователя:', userId);

    // Получаем текущий раунд
    const roomResult = await query(`
      SELECT currentround FROM games WHERE gameid = $1
    `, [roomId]);

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const currentRound = roomResult.rows[0].currentround;

    // Получаем roundid
    const roundResult = await query(`
      SELECT roundid FROM rounds 
      WHERE gameid = $1 AND roundnumber = $2
    `, [roomId, currentRound]);

    if (roundResult.rows.length === 0) {
      return res.status(400).json({ error: 'Раунд не найден' });
    }

    const roundId = roundResult.rows[0].roundid;

    // Проверяем, не отгадывал ли уже пользователь этого художника
    const existingGuess = await query(`
      SELECT * FROM guesses 
      WHERE roundid = $1 AND userid = $2 AND guess_for_userid = $3
    `, [roundId, userId, artistUserId]);

    if (existingGuess.rows.length > 0) {
      return res.status(400).json({ error: 'Вы уже отгадывали этого художника' });
    }

    // Сохраняем догадку
    await query(`
      INSERT INTO guesses (roundid, userid, guess_for_userid, guess)
      VALUES ($1, $2, $3, $4)
    `, [roundId, userId, artistUserId, guess]);

    console.log('✅ Догадка сохранена');

    res.json({
      success: true,
      message: 'Догадка отправлена'
    });

  } catch (error) {
    console.error('❌ Ошибка отправки догадки:', error);
    res.status(500).json({ error: 'Ошибка отправки догадки: ' + error.message });
  }
});

// ✅ ДОБАВЛЕНО: Принудительный переход к угадыванию (для хоста)
router.post('/:roomId/force-guessing', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    console.log('🚀 Принудительный переход к угадыванию для комнаты:', roomId);

    // Проверяем, что пользователь - хост
    const hostCheck = await query(`
      SELECT ishost FROM game_players 
      WHERE gameid = $1 AND userid = $2 AND ishost = true
    `, [roomId, req.user.userId]);

    if (hostCheck.rows.length === 0) {
      console.log('❌ User is not host');
      return res.status(403).json({ error: 'Только хост может принудительно перейти к угадыванию' });
    }

    // Получаем текущий раунд
    const roomResult = await query(`
      SELECT currentround FROM games WHERE gameid = $1
    `, [roomId]);

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const currentRound = roomResult.rows[0].currentround;

    // Получаем roundid
    const roundResult = await query(`
      SELECT roundid FROM rounds 
      WHERE gameid = $1 AND roundnumber = $2
    `, [roomId, currentRound]);

    if (roundResult.rows.length === 0) {
      return res.status(400).json({ error: 'Раунд не найден' });
    }

    const roundId = roundResult.rows[0].roundid;

    // Обновляем статус раунда
    await query(`
      UPDATE rounds SET status = 'guessing' WHERE roundid = $1
    `, [roundId]);

    console.log('✅ Принудительный переход к угадыванию выполнен');

    res.json({
      success: true,
      message: 'Этап угадывания запущен'
    });

  } catch (error) {
    console.error('❌ Ошибка принудительного перехода к угадыванию:', error);
    res.status(500).json({ error: 'Ошибка принудительного перехода к угадыванию: ' + error.message });
  }
});

module.exports = router;