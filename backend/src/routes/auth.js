const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Валидация входных данных
const validateRegistration = (login, password) => {
  if (!login || !password) {
    return 'Логин и пароль обязательны';
  }
  if (login.length < 3 || login.length > 50) {
    return 'Логин должен быть от 3 до 50 символов';
  }
  if (password.length < 6) {
    return 'Пароль должен быть не менее 6 символов';
  }
  return null;
};

// Регистрация пользователя
router.post('/register', async (req, res) => {
  try {
    console.log('📨 Register request received:', { ...req.body, password: '***' });
    
    const { login, password } = req.body;
    
    // Валидация
    const validationError = validateRegistration(login, password);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    // Проверяем существует ли пользователь
    const userExists = await query('SELECT * FROM users WHERE login = $1', [login]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: 'Пользователь уже существует' });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Создаем пользователя
    const result = await query(
      `INSERT INTO users (login, passwordhash, gamesplayed, gameswon, points) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING userid, login, gamesplayed, gameswon, points`,
      [login, hashedPassword, 0, 0, 0]
    );

    const newUser = result.rows[0];
    console.log('✅ User created:', { ...newUser, password: '***' });

    // Генерируем JWT токен
    const token = jwt.sign(
      { userId: newUser.userid }, 
      process.env.JWT_SECRET || 'fallback-secret-key-change-in-production',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Пользователь успешно создан',
      user: {
        userid: newUser.userid,
        login: newUser.login,
        gamesplayed: newUser.gamesplayed || 0,
        gameswon: newUser.gameswon || 0,
        points: newUser.points || 0
      },
      token
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Авторизация пользователя
router.post('/login', async (req, res) => {
  try {
    console.log('📨 Login request received:', { ...req.body, password: '***' });
    
    const { login, password } = req.body;
    
    // Базовая валидация
    if (!login || !password) {
      return res.status(400).json({ error: 'Логин и пароль обязательны' });
    }

    // Ищем пользователя
    const result = await query('SELECT * FROM users WHERE login = $1', [login]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверные логин или пароль' });
    }

    const user = result.rows[0];
    
    // Проверяем пароль
    const isValidPassword = await bcrypt.compare(password, user.passwordhash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверные логин или пароль' });
    }

    // Генерируем JWT токен
    const token = jwt.sign(
      { userId: user.userid }, 
      process.env.JWT_SECRET || 'fallback-secret-key-change-in-production',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Вход выполнен успешно',
      user: {
        userid: user.userid,
        login: user.login,
        gamesplayed: user.gamesplayed || 0,
        gameswon: user.gameswon || 0,
        points: user.points || 0
      },
      token
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение информации о пользователе
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    
    if (!token) {
      return res.status(401).json({ error: 'Требуется токен доступа' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-in-production');
    
    const result = await query(
      'SELECT userid, login, gamesplayed, gameswon, points FROM users WHERE userid = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Неверный токен' });
    }
    console.error('❌ Get user error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновление статистики пользователя
router.put('/stats', async (req, res) => {
  try {
    const { gamesplayed, gameswon, points } = req.body;
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    
    if (!token) {
      return res.status(401).json({ error: 'Требуется токен доступа' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-in-production');
    
    const result = await query(
      `UPDATE users 
       SET gamesplayed = COALESCE($1, gamesplayed),
           gameswon = COALESCE($2, gameswon),
           points = COALESCE($3, points)
       WHERE userid = $4
       RETURNING userid, login, gamesplayed, gameswon, points`,
      [gamesplayed, gameswon, points, decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
      message: 'Статистика обновлена успешно',
      user: result.rows[0]
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Неверный токен' });
    }
    console.error('❌ Update stats error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;