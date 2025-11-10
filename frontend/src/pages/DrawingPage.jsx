import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./DrawingPage.css";
import { useAuth } from '../context/AuthContext';

export default function DrawingPage({ onDrawingComplete }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { roomId } = useParams();
  
  const canvasRef = useRef(null);
  const [currentWord, setCurrentWord] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [timeLeft, setTimeLeft] = useState(60);
  const [showWord, setShowWord] = useState(true);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [players, setPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [gameStatus, setGameStatus] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [allWordsSubmitted, setAllWordsSubmitted] = useState(false);
  
  const timerRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // ✅ Используем roomId из URL
  const roomCode = roomId;

  console.log('🎨 DrawingPage mounted, roomCode from URL:', roomCode);

  const colors = [
    "#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00",
    "#FF00FF", "#00FFFF", "#FFA500", "#800080", "#FFC0CB",
    "#A52A2A", "#808080", "#FFFFFF"
  ];

  const brushSizes = [2, 5, 10, 15, 20];

  // ✅ ЗАПУСК ЭТАПА РИСОВАНИЯ (для хоста)
  const startDrawingPhase = useCallback(async () => {
    if (!roomCode) return;

    try {
      console.log('🚀 Хост запускает этап рисования...');
      const token = localStorage.getItem('token');
      const response = await fetch(`http://urka-phone.ydns.eu/api/game/${roomCode}/start-drawing`, { // ← ИСПРАВЛЕНО
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        console.log('✅ Этап рисования запущен!');
        // Перезагружаем данные
        loadGameData();
        fetchDrawingWord();
      } else {
        const errorData = await response.json();
        console.error('❌ Ошибка запуска рисования:', errorData);
        setError(errorData.error || "Не удалось запустить рисование");
      }
    } catch (error) {
      console.error('❌ Ошибка:', error);
      setError("Ошибка соединения с сервером");
    }
  }, [roomCode]);

  // ✅ ПРОВЕРКА СТАТУСА СЛОВ
  const checkWordsStatus = useCallback(async () => {
    if (!roomCode) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://urka-phone.ydns.eu/api/game/${roomCode}/words-status`, { // ← ИСПРАВЛЕНО
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Статус слов:', data);
        
        if (data.allSubmitted) {
          setAllWordsSubmitted(true);
          setError("Все слова отправлены! Хост может запустить рисование.");
        } else {
          setAllWordsSubmitted(false);
          setError(`Ожидаем слова: ${data.submittedCount}/${data.totalPlayers} игроков`);
        }
      }
    } catch (error) {
      console.error('❌ Ошибка проверки статуса:', error);
    }
  }, [roomCode]);

  // ✅ ПОЛУЧЕНИЕ СЛОВА ДЛЯ РИСОВАНИЯ
  const fetchDrawingWord = useCallback(async () => {
    if (!roomCode) {
      console.error('❌ roomCode не указан');
      setError("Не указан код комнаты");
      setIsLoading(false);
      return;
    }

    try {
      console.log('🔄 Получаем слово для рисования...');
      const token = localStorage.getItem('token');
      const response = await fetch(`http://urka-phone.ydns.eu/api/game/${roomCode}/my-drawing-word`, { // ← ИСПРАВЛЕНО
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('📡 Ответ от сервера:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📝 Данные слова:', data);
        
        if (data.success && data.word) {
          console.log('✅ Получено слово для рисования:', data.word);
          setCurrentWord(data.word);
          setError("");
          setIsLoading(false);
        } else {
          console.log('ℹ️ Слово еще не доступно:', data.error);
          setError("Слово для рисования еще не готово. Ожидаем запуска этапа.");
          setIsLoading(false);
        }
      } else {
        console.log('ℹ️ Слово не доступно (статус:', response.status, ')');
        setError("Ожидаем запуска этапа рисования...");
        setIsLoading(false);
      }
    } catch (error) {
      console.error('❌ Ошибка получения слова:', error);
      setError("Ошибка соединения с сервером");
      setIsLoading(false);
    }
  }, [roomCode]);

  // ✅ ЗАГРУЗКА ДАННЫХ ИГРЫ
  const loadGameData = useCallback(async () => {
    if (!roomCode) return;

    try {
      console.log('🔄 Загрузка данных игры...');
      const token = localStorage.getItem('token');
      const response = await fetch(`http://urka-phone.ydns.eu/api/game/${roomCode}`, { // ← ИСПРАВЛЕНО
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🎮 Данные игры:', data);
        
        if (isMountedRef.current) {
          setPlayers(data.players || []);
          if (data.room?.currentround) setCurrentRound(data.room.currentround);
          if (data.room?.totalrounds) setTotalRounds(data.room.totalrounds);
          if (data.room?.status) setGameStatus(data.room.status);
          
          // Проверяем, является ли пользователь хостом
          const currentPlayer = data.players?.find(p => p.userid === user?.userId);
          setIsHost(currentPlayer?.ishost || false);
          
          // Если игра в стадии рисования, пытаемся получить слово
          if (data.room?.status === 'playing') {
            fetchDrawingWord();
          } else {
            setIsLoading(false);
            checkWordsStatus();
          }
        }
      } else {
        console.error('❌ Ошибка загрузки данных игры');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки данных игры:', error);
      setIsLoading(false);
    }
  }, [roomCode, user, fetchDrawingWord, checkWordsStatus]);

  // ✅ СОХРАНЕНИЕ РИСУНКА
  const saveDrawing = useCallback(async (drawingData) => {
    if (!roomCode) return false;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://urka-phone.ydns.eu/api/game/${roomCode}/save-drawing`, { // ← ИСПРАВЛЕНО
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ drawingData })
      });
      return response.ok;
    } catch (error) {
      console.error('❌ Ошибка:', error);
      return false;
    }
  }, [roomCode]);

  // ✅ ЗАВЕРШЕНИЕ РИСОВАНИЯ
  const finishDrawing = useCallback(async () => {
    if (!roomCode) return false;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://urka-phone.ydns.eu/api/game/${roomCode}/finish-drawing`, {// ← ИСПРАВЛЕНО
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.ok;
    } catch (error) {
      console.error('❌ Ошибка:', error);
      return false;
    }
  }, [roomCode]);

  useEffect(() => {
    console.log('🎨 DrawingPage mounted, roomCode:', roomCode);
    isMountedRef.current = true;
    
    if (roomCode) {
      loadGameData();

      // Таймер для авто-завершения
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Обновляем данные каждые 3 секунды
      const interval = setInterval(loadGameData, 3000);

      return () => {
        console.log('🎨 DrawingPage unmounted');
        isMountedRef.current = false;
        clearInterval(timer);
        clearInterval(interval);
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    } else {
      console.error('❌ roomCode не передан в компонент');
      setError("Не указан код комнаты");
      setIsLoading(false);
    }
  }, [roomCode, loadGameData]);

  const handleTimeUp = useCallback(async () => {
    console.log('🎨 Время вышло, завершаем рисование...');
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const drawingData = canvas.toDataURL();
    const saved = await saveDrawing(drawingData);
    if (saved) {
      const finished = await finishDrawing();
      if (finished && onDrawingComplete) {
        onDrawingComplete(drawingData);
      }
    }
  }, [saveDrawing, finishDrawing, onDrawingComplete]);

  // Инициализация canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      canvas.width = 800;
      canvas.height = 500;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      console.log('✅ Canvas инициализирован');
    }
  }, []);

  // Функции рисования
  const startDrawing = (e) => {
    if (!currentWord) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    lastPosRef.current = { x, y };
    
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || !currentWord) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    
    lastPosRef.current = { x, y };
  };

  const stopDrawing = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.closePath();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleCompleteDrawing = async () => {
    console.log('✅ Пользователь завершил рисование');
    await handleTimeUp();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const toggleWordVisibility = () => {
    setShowWord(!showWord);
  };

  const retryLoad = () => {
    setIsLoading(true);
    setError("");
    loadGameData();
  };

  // ✅ РЕНДЕРИМ РАЗНЫЕ СОСТОЯНИЯ

  if (isLoading) {
    return (
      <div className="drawing-container loading">
        <div className="loading-spinner">🎨</div>
        <div className="loading-text">Загрузка игры...</div>
        <div className="loading-details">
          Комната: {roomCode}<br/>
          Получаем слово для рисования...
        </div>
      </div>
    );
  }

  // ✅ СОСТОЯНИЕ: ХОСТ МОЖЕТ ЗАПУСТИТЬ РИСОВАНИЕ
  if (isHost && allWordsSubmitted && !currentWord) {
    return (
      <div className="drawing-container waiting-host">
        <div className="waiting-icon">🚀</div>
        <div className="waiting-title">Все слова отправлены!</div>
        <div className="waiting-text">
          Все игроки отправили свои слова. Вы можете запустить этап рисования.
        </div>
        <button className="start-drawing-btn" onClick={startDrawingPhase}>
          🎨 Запустить рисование
        </button>
        <div className="waiting-details">
          Игроков: {players.length}<br/>
          Слов отправлено: Все
        </div>
      </div>
    );
  }

  // ✅ СОСТОЯНИЕ: ОЖИДАНИЕ ЗАПУСКА РИСОВАНИЯ
  if (!currentWord) {
    return (
      <div className="drawing-container waiting">
        <div className="waiting-icon">⏳</div>
        <div className="waiting-title">Ожидаем запуска рисования</div>
        <div className="waiting-text">
          {isHost 
            ? "Ожидаем, когда все игроки отправят слова, чтобы запустить рисование."
            : "Хост скоро запустит этап рисования. Ожидайте..."
          }
        </div>
        {isHost && (
          <button className="check-status-btn" onClick={checkWordsStatus}>
            🔄 Проверить статус
          </button>
        )}
        <div className="waiting-details">
          Статус: {gameStatus}<br/>
          {error && <div className="waiting-error">{error}</div>}
        </div>
        <button className="retry-btn" onClick={retryLoad}>
          Обновить
        </button>
      </div>
    );
  }

  if (error && !currentWord) {
    return (
      <div className="drawing-container error">
        <div className="error-icon">❌</div>
        <div className="error-text">{error}</div>
        <div className="error-details">
          Комната: {roomCode || 'не указана'}
        </div>
        <button className="retry-btn" onClick={retryLoad}>
          Попробовать снова
        </button>
        <button className="back-btn" onClick={() => navigate('/')}>
          Вернуться на главную
        </button>
      </div>
    );
  }

  if (!currentWord) {
    return (
      <div className="drawing-container error">
        <div className="error-icon">🎨</div>
        <div className="error-text">Не удалось загрузить слово для рисования</div>
        <div className="error-details">
          Комната: {roomCode}<br/>
          Возможно, игра еще не началась или произошла ошибка.
        </div>
        <button className="retry-btn" onClick={retryLoad}>
          Попробовать снова
        </button>
      </div>
    );
  }

  console.log('✅ Рендерим интерфейс рисования, слово:', currentWord);

  return (
    <div className="drawing-container">
      <header className="drawing-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Назад
        </button>
        <div className="drawing-title">
          <h1>🎨 Время рисовать!</h1>
          <div className="room-info">
            Комната: {roomCode} | Раунд: {currentRound}/{totalRounds}
            {isHost && <span className="host-badge">👑 Хост</span>}
          </div>
        </div>
        <div className="timer-section">
          <div className={`timer ${timeLeft <= 10 ? 'urgent' : ''}`}>
            ⏰ {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      <div className="drawing-content">
        <div className="tools-panel">
          <h3>🛠️ Инструменты</h3>
          
          <div className="color-palette">
            <h4>Цвета:</h4>
            <div className="colors-grid">
              {colors.map((colorItem, index) => (
                <button
                  key={index}
                  className={`color-btn ${color === colorItem ? 'active' : ''}`}
                  style={{ backgroundColor: colorItem }}
                  onClick={() => setColor(colorItem)}
                />
              ))}
            </div>
          </div>

          <div className="brush-sizes">
            <h4>Размер кисти:</h4>
            <div className="sizes-grid">
              {brushSizes.map((size, index) => (
                <button
                  key={index}
                  className={`size-btn ${brushSize === size ? 'active' : ''}`}
                  onClick={() => setBrushSize(size)}
                >
                  <div 
                    className="brush-preview"
                    style={{ 
                      width: size, 
                      height: size,
                      backgroundColor: color 
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="actions">
            <button className="action-btn clear" onClick={clearCanvas}>
              🗑️ Очистить
            </button>
            <button 
              className={`action-btn ${showWord ? 'hide' : 'show'}`}
              onClick={toggleWordVisibility}
            >
              {showWord ? '👁️‍🗨️ Скрыть слово' : '👁️‍🗨️ Показать слово'}
            </button>
            <button 
              className="action-btn complete"
              onClick={handleCompleteDrawing}
            >
              ✅ Завершить
            </button>
          </div>
        </div>

        <div className="drawing-area">
          <div className={`word-display ${showWord ? 'visible' : 'hidden'}`}>
            <div className="word-label">Рисуйте слово:</div>
            <div className="the-word">{currentWord}</div>
            <div className="word-hint">(Это слово придумал другой игрок)</div>
          </div>

          <div className="canvas-container">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={(e) => {
                e.preventDefault();
                startDrawing(e.touches[0]);
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                draw(e.touches[0]);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                stopDrawing();
              }}
              className="drawing-canvas"
            />
          </div>
        </div>

        <div className="info-panel">
          <h3>📊 Информация</h3>
          
          <div className="current-artist">
            <h4>🎨 Сейчас рисует:</h4>
            <div className="artist-info">
              <div className="artist-avatar">
                {user?.login?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="artist-name">
                {user?.login || 'Вы'}
                <span className="you-badge">(Вы)</span>
              </div>
            </div>
          </div>

          <div className="game-progress">
            <h4>📈 Прогресс:</h4>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${((60 - timeLeft) / 60) * 100}%` }}
              />
            </div>
            <div className="progress-text">
              {60 - timeLeft} из 60 секунд
            </div>
          </div>

          <div className="quick-complete">
            <button 
              className="complete-now-btn"
              onClick={handleCompleteDrawing}
            >
              🏁 Завершить сейчас
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}