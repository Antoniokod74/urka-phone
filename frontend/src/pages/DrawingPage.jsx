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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  
  const timerRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastPosRef = useRef({ x: 0, y: 0 });

  const roomCode = roomId;

  console.log('🎨 DrawingPage mounted, roomCode:', roomCode);

  const colors = [
    "#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00",
    "#FF00FF", "#00FFFF", "#FFA500", "#800080", "#FFC0CB",
    "#A52A2A", "#808080", "#FFFFFF"
  ];

  const brushSizes = [2, 5, 10, 15, 20];

  // ✅ ПОЛУЧАЕМ СЛОВО ДЛЯ РИСОВАНИЯ (от другого игрока - автор скрыт)
  const fetchDrawingWord = useCallback(async () => {
    if (!roomCode) {
      console.error('❌ roomCode не указан');
      setError("Не указан код комнаты");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError("Требуется авторизация");
        return;
      }

      console.log('🔄 Получаем слово от другого игрока...');
      const response = await fetch(`http://urka-phone.ydns.eu/api/game/${roomCode}/my-drawing-word`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📝 Ответ сервера:', data);
        
        if (data.success && data.word) {
          console.log('✅ Получено слово для рисования:', data.word);
          setCurrentWord(data.word);
          setError("");
        } else {
          console.log('⏳ Слово еще не готово:', data.error || 'ожидаем');
        }
      } else if (response.status === 401) {
        setError("Ошибка авторизации");
      } else {
        console.log('⏳ Сервер не готов (статус:', response.status, ')');
      }
    } catch (error) {
      console.error('❌ Ошибка запроса:', error);
    }
  }, [roomCode]);

  // ✅ АВТООБНОВЛЕНИЕ
  useEffect(() => {
    if (!roomCode) return;

    console.log('🚀 Запускаем автообновление...');
    isMountedRef.current = true;

    // Первая загрузка
    fetchDrawingWord();

    // Интервал для автообновления
    const interval = setInterval(() => {
      if (isMountedRef.current && !currentWord) {
        console.log('🔄 Авто-проверка...');
        setLastUpdate(Date.now());
        fetchDrawingWord();
      }
    }, 3000);

    // Таймер рисования
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      console.log('🧹 Очистка таймеров');
      isMountedRef.current = false;
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [roomCode, currentWord, fetchDrawingWord]);

  // ✅ ФУНКЦИИ РИСОВАНИЯ
  const saveDrawing = useCallback(async (drawingData) => {
    if (!roomCode) return false;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://urka-phone.ydns.eu/api/game/${roomCode}/save-drawing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ drawingData })
      });
      return response.ok;
    } catch (error) {
      console.error('❌ Ошибка сохранения:', error);
      return false;
    }
  }, [roomCode]);

  const finishDrawing = useCallback(async () => {
    if (!roomCode) return false;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://urka-phone.ydns.eu/api/game/${roomCode}/finish-drawing`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.ok;
    } catch (error) {
      console.error('❌ Ошибка завершения:', error);
      return false;
    }
  }, [roomCode]);

  const handleTimeUp = useCallback(async () => {
    console.log('🎨 Время вышло');
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

  // ✅ ПРАВИЛЬНАЯ ИНИЦИАЛИЗАЦИЯ CANVAS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      
      // ✅ Устанавливаем правильные размеры
      const container = canvas.parentElement;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      
      // ✅ Настраиваем контекст рисования
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      console.log('✅ Canvas инициализирован:', canvas.width, 'x', canvas.height);
    }
  }, []);

  // ✅ ОБНОВЛЯЕМ НАСТРОЙКИ КИСТИ ПРИ ИЗМЕНЕНИИ ЦВЕТА И РАЗМЕРА
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
    }
  }, [color, brushSize]);

  // ✅ ФУНКЦИИ РИСОВАНИЯ - ИСПРАВЛЕННЫЕ
  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    if (!currentWord) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoordinates(e);
    
    lastPosRef.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || !currentWord) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoordinates(e);
    
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPosRef.current = { x, y };
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    
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
    
    // Восстанавливаем настройки кисти
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
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
    setError("");
    fetchDrawingWord();
  };

  const forceCheck = () => {
    console.log('🔄 Принудительная проверка');
    fetchDrawingWord();
  };

  // ✅ РЕНДЕРИНГ
  if (error) {
    return (
      <div className="drawing-container error">
        <div className="error-icon">❌</div>
        <div className="error-text">{error}</div>
        <button className="retry-btn" onClick={retryLoad}>
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
          <h1>🎨 Рисование</h1>
          <div className="room-info">
            Комната: {roomCode} | {currentWord ? 'Рисуем слово!' : 'Ожидаем слово...'}
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
                  title={colorItem}
                />
              ))}
            </div>
            <div className="current-color">
              Текущий: <span className="color-sample" style={{ backgroundColor: color }}></span>
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
                  title={`Размер ${size}px`}
                >
                  <div 
                    className="brush-preview"
                    style={{ 
                      width: Math.max(8, size), 
                      height: Math.max(8, size),
                      backgroundColor: color,
                      borderRadius: '50%'
                    }}
                  />
                </button>
              ))}
            </div>
            <div className="current-size">
              Текущий: {brushSize}px
            </div>
          </div>

          <div className="actions">
            <button className="action-btn clear" onClick={clearCanvas}>
              🗑️ Очистить
            </button>
            <button className="action-btn" onClick={toggleWordVisibility}>
              {showWord ? '👁️‍🗨️ Скрыть слово' : '👁️‍🗨️ Показать слово'}
            </button>
            <button className="action-btn complete" onClick={handleCompleteDrawing}>
              ✅ Завершить
            </button>
            {!currentWord && (
              <button className="action-btn refresh" onClick={forceCheck}>
                🔄 Проверить
              </button>
            )}
          </div>

          {/* ✅ СТАТУС ОБНОВЛЕНИЯ */}
          {!currentWord && (
            <div className="status-info">
              <div className="status-text">⏳ Ожидаем слово от другого игрока...</div>
              <div className="status-details">
                Система случайным образом распределит слова между игроками
                <br/>
                Последняя проверка: {new Date(lastUpdate).toLocaleTimeString()}
                <br/>
                Авто-обновление каждые 3 секунды
              </div>
            </div>
          )}

          {/* ✅ ИНФОРМАЦИЯ О СИСТЕМЕ */}
          {currentWord && (
            <div className="game-rules">
              <h4>🎯 Правила:</h4>
              <ul>
                <li>Вы получили слово, которое придумал другой игрок</li>
                <li>Автор слова будет раскрыт только в конце раунда</li>
                <li>Постарайтесь нарисовать так, чтобы угадали!</li>
              </ul>
            </div>
          )}
        </div>

        <div className="drawing-area">
          <div className={`word-display ${showWord ? 'visible' : 'hidden'}`}>
            <div className="word-label">
              {currentWord ? 'Рисуйте слово:' : 'Слово для рисования:'}
            </div>
            <div className="the-word">
              {currentWord || '⏳ Ожидаем...'}
            </div>
            {currentWord && (
              <div className="word-hint">
                🎭 <strong>Слово от другого игрока</strong>
                <br/>
                <small>Автор будет раскрыт в результатах</small>
              </div>
            )}
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
              style={{ 
                cursor: currentWord ? 'crosshair' : 'not-allowed',
                border: '2px solid #ddd',
                borderRadius: '8px',
                background: '#ffffff',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
              }}
            />
            {!currentWord && (
              <div className="canvas-overlay">
                <div className="overlay-content">
                  ⏳ Ожидаем распределение слов между игроками...
                  <br/>
                  <small>Рисование будет доступно когда вы получите слово</small>
                </div>
              </div>
            )}
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

          <div className="current-tools">
            <h4>🎨 Текущие настройки:</h4>
            <div className="tools-info">
              <div className="tool-item">
                <span>Цвет:</span>
                <span className="color-sample" style={{ backgroundColor: color }}></span>
              </div>
              <div className="tool-item">
                <span>Размер кисти:</span>
                <span>{brushSize}px</span>
              </div>
            </div>
          </div>

          {currentWord && (
            <div className="word-source">
              <h4>🎁 Источник слова:</h4>
              <div className="source-info">
                <div className="mystery-author">🎭 Анонимный игрок</div>
                <small>Раскроется в конце раунда</small>
              </div>
            </div>
          )}

          <div className="quick-complete">
            <button 
              className="complete-now-btn"
              onClick={handleCompleteDrawing}
              disabled={!currentWord}
            >
              🏁 Завершить сейчас
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}