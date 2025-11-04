import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./GuessingPage.css";
import { useAuth } from '../context/AuthContext';

export default function GuessingPage({ drawings = [], players = [], roomCode, onSubmitGuess }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentGuess, setCurrentGuess] = useState("");
  const [timeLeft, setTimeLeft] = useState(45);
  const [currentDrawingIndex, setCurrentDrawingIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState(null);
  const [gameData, setGameData] = useState({});
  
  const timerRef = useRef(null);
  const isMountedRef = useRef(true);

  // Загрузка данных игры в реальном времени
  const loadGameData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/game/${roomCode}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (isMountedRef.current) {
          setGameData(data);
          
          // Обновляем таймер с сервера если есть
          if (data.room?.timeLeft) {
            setTimeLeft(data.room.timeLeft);
          }
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки данных игры:', error);
    }
  }, [roomCode]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Загружаем данные игры
    loadGameData();
    
    // Обновляем каждые 2 секунды
    const interval = setInterval(loadGameData, 2000);
    
    // WebSocket для реального времени
    let ws = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/game/${roomCode}`;
      ws = new WebSocket(wsUrl);
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'GUESS_UPDATE' || data.type === 'TIME_UPDATE') {
          loadGameData();
        }
      };
    } catch (error) {
      console.log('WebSocket не поддерживается, используем polling');
    }

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      if (ws) ws.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loadGameData, roomCode]);

  useEffect(() => {
    if (drawings.length > 0 && currentDrawingIndex < drawings.length) {
      setCurrentDrawing(drawings[currentDrawingIndex]);
      setCurrentGuess("");
      setShowHint(false);
      setTimeLeft(45);
    }
  }, [currentDrawingIndex, drawings]);

  const handleSubmit = useCallback(async () => {
    if (currentGuess.trim() && currentDrawing) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/game/${roomCode}/guess`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            guess: currentGuess.trim(),
            drawingIndex: currentDrawingIndex
          })
        });

        if (response.ok) {
          console.log('✅ Догадка отправлена');
          if (onSubmitGuess) {
            onSubmitGuess(currentGuess.trim(), currentDrawingIndex);
          }
        } else {
          alert('Ошибка отправки догадки');
        }
      } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка отправки догадки');
      }
    } else {
      alert("Пожалуйста, введите вашу догадку!");
    }
  }, [currentGuess, currentDrawing, onSubmitGuess, currentDrawingIndex, roomCode]);

  // Таймер на клиенте как fallback
  useEffect(() => {
    if (timeLeft > 0 && currentDrawing) {
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setTimeLeft(prev => prev - 1);
        }
      }, 1000);
    } else if (timeLeft === 0 && currentDrawing) {
      handleSubmit();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, currentDrawing, handleSubmit]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getPlayerStatus = (player) => {
    // Используем данные с сервера о статусе игрока
    if (player.hasGuessed || player.guessed) {
      return "submitted";
    }
    return "guessing";
  };

  const nextDrawing = () => {
    if (currentDrawingIndex < drawings.length - 1) {
      setCurrentDrawingIndex(prev => prev + 1);
    } else {
      // Переходим к результатам
      navigate(`/room/${roomCode}/results`);
    }
  };

  const quickGuesses = ["Кот", "Собака", "Дом", "Машина", "Дерево", "Солнце", "Человек", "Птица"];

  // Используем актуальных игроков из gameData или из пропсов
  const actualPlayers = gameData.players || players;
  const actualDrawings = gameData.drawings || drawings;

  if (!currentDrawing || actualDrawings.length === 0) {
    return (
      <div className="guess-container">
        <div className="guess-loading-message">
          🔄 Загрузка рисунков...
        </div>
      </div>
    );
  }

  // Проверяем отправил ли текущий пользователь догадку
  const currentPlayer = actualPlayers.find(p => p.userid === user?.userid);
  const hasSubmitted = currentPlayer ? getPlayerStatus(currentPlayer) === "submitted" : false;

  return (
    <div className="guess-container">
      <header className="guess-header">
        <button className="guess-back-button" onClick={() => navigate(-1)}>
          ← Назад
        </button>
        <div className="guess-title">
          <h1>🎯 Время угадывать!</h1>
          <div className="guess-room-info">
            Комната: {roomCode} | Рисунок {currentDrawingIndex + 1} из {actualDrawings.length}
          </div>
        </div>
        <div className="guess-timer-section">
          <div className={`guess-timer ${timeLeft <= 10 ? 'urgent' : ''}`}>
            ⏰ {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      <div className="guess-content">
        <div className="guess-control-panel">
          <div className="guess-input-card">
            <h3>💭 Ваша догадка</h3>
            <div className="guess-input-wrapper">
              <input
                type="text"
                value={currentGuess}
                onChange={(e) => setCurrentGuess(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Что изображено на рисунке?"
                maxLength={50}
                disabled={hasSubmitted}
                className="guess-input"
              />
              <div className="guess-char-counter">
                {currentGuess.length}/50 символов
              </div>
            </div>
            
            {!hasSubmitted ? (
              <button
                onClick={handleSubmit}
                disabled={!currentGuess.trim()}
                className={`guess-send-button ${currentGuess.trim() ? 'active' : ''}`}
              >
                🚀 Отправить догадку
              </button>
            ) : (
              <div className="guess-success-card">
                <div className="guess-success-icon">✅</div>
                <div className="guess-success-content">
                  <h4>Успешно отправлено!</h4>
                  <p>«{currentGuess}»</p>
                </div>
              </div>
            )}
          </div>

          <div className="guess-hint-card">
            <h4>💡 Подсказка</h4>
            <button 
              className={`guess-hint-button ${showHint ? 'active' : ''}`}
              onClick={() => setShowHint(!showHint)}
              disabled={hasSubmitted}
            >
              {showHint ? '👁️ Скрыть подсказку' : '🔍 Показать подсказку'}
            </button>
            {showHint && currentDrawing.word && (
              <div className="guess-hint-content">
                Первая буква: <span className="guess-hint-letter">{currentDrawing.word.charAt(0)}</span>
              </div>
            )}
          </div>

          <div className="guess-quick-card">
            <h4>⚡ Быстрые варианты</h4>
            <div className="guess-quick-grid">
              {quickGuesses.map((word, index) => (
                <button
                  key={index}
                  className="guess-quick-item"
                  onClick={() => setCurrentGuess(word)}
                  disabled={hasSubmitted}
                >
                  {word}
                </button>
              ))}
            </div>
          </div>

          {hasSubmitted && currentDrawingIndex < actualDrawings.length - 1 && (
            <div className="guess-next-card">
              <button className="guess-next-button" onClick={nextDrawing}>
                ⏭️ Следующий рисунок
              </button>
            </div>
          )}
        </div>

        <div className="guess-main-panel">
          <div className="guess-artist-info">
            <div className="guess-artist-badge">
              <div className="guess-artist-avatar">🎨</div>
              <div className="guess-artist-text">
                <div className="guess-artist-name">Анонимный художник</div>
                <div className="guess-artist-desc">Попробовал изобразить что-то интересное...</div>
              </div>
            </div>
          </div>

          <div className="guess-drawing-space">
            <div className="guess-drawing-frame">
              <img 
                src={currentDrawing.image || currentDrawing.dataURL} 
                alt="Рисунок для угадывания"
                className="guess-drawing-img"
                onError={(e) => {
                  console.error("Ошибка загрузки изображения:", currentDrawing);
                  e.target.style.display = 'none';
                }}
              />
            </div>
          </div>

          <div className="guess-time-progress">
            <div className="guess-time-text">
              Осталось времени: <span className="guess-time-value">{formatTime(timeLeft)}</span>
            </div>
            <div className="guess-progress-bar">
              <div 
                className="guess-progress-fill" 
                style={{ width: `${((45 - timeLeft) / 45) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="guess-players-panel">
          <h3>👥 Игроки онлайн ({actualPlayers.length})</h3>
          
          <div className="guess-stats-card">
            <div className="guess-stats-header">
              <span>Прогресс угадывания</span>
              <span className="guess-stats-count">
                {actualPlayers.filter(p => getPlayerStatus(p) === 'submitted').length}/{actualPlayers.length}
              </span>
            </div>
            <div className="guess-stats-progress">
              <div 
                className="guess-stats-fill" 
                style={{ 
                  width: `${(actualPlayers.filter(p => getPlayerStatus(p) === 'submitted').length / Math.max(actualPlayers.length, 1)) * 100}%` 
                }}
              />
            </div>
          </div>

          <div className="guess-players-list">
            {actualPlayers.map((player) => (
              <div key={player.userid} className={`guess-player-card ${getPlayerStatus(player)}`}>
                <div className="guess-player-avatar">
                  {player.login?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="guess-player-info">
                  <div className="guess-player-name">
                    {player.login}
                    {player.userid === user?.userid && <span className="guess-you-label">(Вы)</span>}
                  </div>
                  <div className="guess-player-status">
                    {getPlayerStatus(player) === 'submitted' ? (
                      <span className="guess-status-done">✅ Угадал</span>
                    ) : (
                      <span className="guess-status-thinking">🤔 Думает...</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="guess-round-stats">
            <h4>📊 Статистика раунда</h4>
            <div className="guess-stats-grid">
              <div className="guess-stat-box">
                <div className="guess-stat-number">{currentDrawingIndex + 1}</div>
                <div className="guess-stat-label">Текущий</div>
              </div>
              <div className="guess-stat-box">
                <div className="guess-stat-number">{actualDrawings.length}</div>
                <div className="guess-stat-label">Всего</div>
              </div>
              <div className="guess-stat-box">
                <div className="guess-stat-number">{timeLeft}</div>
                <div className="guess-stat-label">Секунд</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}