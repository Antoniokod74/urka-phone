import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./DrawingPage.css";
import { useAuth } from '../context/AuthContext';

export default function DrawingPage({ roomCode, onDrawingComplete }) {
  const navigate = useNavigate();
  const { user } = useAuth();
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
  
  const timerRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastPosRef = useRef({ x: 0, y: 0 });

  const colors = [
    "#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00",
    "#FF00FF", "#00FFFF", "#FFA500", "#800080", "#FFC0CB",
    "#A52A2A", "#808080", "#FFFFFF"
  ];

  const brushSizes = [2, 5, 10, 15, 20];

  // ✅ ПРАВИЛЬНОЕ ПОЛУЧЕНИЕ СЛОВА ДЛЯ РИСОВАНИЯ
  const fetchDrawingWord = useCallback(async () => {
    if (!roomCode) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/game/${roomCode}/my-drawing-word`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.word) {
          console.log('✅ Получено слово для рисования:', data.word);
          setCurrentWord(data.word);
        } else {
          console.error('❌ Слово не получено:', data.error);
        }
      }
    } catch (error) {
      console.error('❌ Ошибка получения слова:', error);
    }
  }, [roomCode]);

  // ✅ ПРАВИЛЬНАЯ ОТПРАВКА РИСУНКА
  const saveDrawing = useCallback(async (drawingData) => {
    if (!roomCode) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/game/${roomCode}/save-drawing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          drawingData: drawingData  // ✅ правильное поле
        })
      });

      if (response.ok) {
        console.log('✅ Рисунок сохранен на сервере');
        return true;
      } else {
        console.error('❌ Ошибка сохранения рисунка');
        return false;
      }
    } catch (error) {
      console.error('❌ Ошибка:', error);
      return false;
    }
  }, [roomCode]);

  // ✅ ПРАВИЛЬНОЕ ЗАВЕРШЕНИЕ РИСОВАНИЯ
  const finishDrawing = useCallback(async () => {
    if (!roomCode) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/game/${roomCode}/finish-drawing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        console.log('✅ Рисование завершено на сервере');
        return true;
      } else {
        console.error('❌ Ошибка завершения рисования');
        return false;
      }
    } catch (error) {
      console.error('❌ Ошибка:', error);
      return false;
    }
  }, [roomCode]);

  // ✅ ЗАГРУЗКА ДАННЫХ ИГРЫ
  const loadGameData = useCallback(async () => {
    if (!roomCode) return;

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
          setPlayers(data.players || []);
          if (data.room?.currentround) setCurrentRound(data.room.currentround);
          if (data.room?.totalrounds) setTotalRounds(data.room.totalrounds);
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки данных игры:', error);
      setIsLoading(false);
    }
  }, [roomCode]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (roomCode) {
      // Загружаем данные игры и слово для рисования
      loadGameData();
      fetchDrawingWord();
      
      // Обновляем данные каждые 3 секунды
      const interval = setInterval(() => {
        loadGameData();
      }, 3000);

      return () => {
        isMountedRef.current = false;
        clearInterval(interval);
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [roomCode, loadGameData, fetchDrawingWord]);

  const handleTimeUp = useCallback(async () => {
    console.log('🎨 Время вышло, завершаем рисование...');
    
    const canvas = canvasRef.current;
    const drawingData = canvas.toDataURL();
    
    // Сохраняем рисунок и завершаем этап
    const saved = await saveDrawing(drawingData);
    if (saved) {
      const finished = await finishDrawing();
      if (finished && onDrawingComplete) {
        onDrawingComplete(drawingData);
      }
    }
  }, [saveDrawing, finishDrawing, onDrawingComplete]);

  // Таймер на клиенте
  useEffect(() => {
    if (timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setTimeLeft(prev => prev - 1);
        }
      }, 1000);
    } else if (timeLeft === 0) {
      handleTimeUp();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, handleTimeUp]);

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
    }
  }, []);

  // Функции рисования (оставляем без изменений)
  const startDrawing = (e) => {
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
    if (!isDrawing) return;
    
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

  if (isLoading) {
    return (
      <div className="drawing-container loading">
        <div className="loading-spinner">🎨</div>
        <div className="loading-text">Загрузка игры...</div>
      </div>
    );
  }

  if (!currentWord) {
    return (
      <div className="drawing-container error">
        <div className="error-icon">❌</div>
        <div className="error-text">Не удалось загрузить слово для рисования</div>
        <button className="retry-btn" onClick={fetchDrawingWord}>
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="drawing-container">
      <header className="drawing-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Назад
        </button>
        <div className="drawing-title">
          <h1>🎨 Время рисовать!</h1>
          <div className="room-info">Комната: {roomCode} | Раунд: {currentRound}/{totalRounds}</div>
        </div>
        <div className="timer-section">
          <div className={`timer ${timeLeft <= 10 ? 'urgent' : ''}`}>
            ⏰ {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      <div className="drawing-content">
        {/* Левая панель инструментов */}
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

        {/* Центральная область рисования */}
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

        {/* Правая панель информации */}
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