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
  const [error, setError] = useState("");
  
  const timerRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastPosRef = useRef({ x: 0, y: 0 });

  const colors = [
    "#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00",
    "#FF00FF", "#00FFFF", "#FFA500", "#800080", "#FFC0CB",
    "#A52A2A", "#808080", "#FFFFFF"
  ];

  const brushSizes = [2, 5, 10, 15, 20];

  // ✅ ПРОВЕРЕННЫЙ МЕТОД ПОЛУЧЕНИЯ СЛОВА - через цепочку
  const fetchDrawingWord = useCallback(async () => {
    if (!roomCode) {
      console.error('❌ roomCode не указан');
      return;
    }

    try {
      console.log('🔄 Получаем слово для рисования... roomId:', roomCode);
      const token = localStorage.getItem('token');
      
      // ✅ Пробуем получить слово через round_chain
      const response = await fetch(`/api/game/${roomCode}/debug-chain`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('📡 Ответ от сервера (debug-chain):', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📝 Данные цепочки:', data);
        
        // Ищем слово для текущего пользователя
        const userChain = data.chain?.find(item => 
          item.userid === user?.userId && item.actiontype === 'drawing'
        );
        
        if (userChain && userChain.word) {
          console.log('✅ Найдено слово для рисования:', userChain.word);
          setCurrentWord(userChain.word);
          setError("");
        } else {
          console.log('❌ Слово не найдено в цепочке, пробуем другой метод...');
          
          // ✅ Альтернативный метод - получаем первое доступное слово
          if (data.chain && data.chain.length > 0) {
            const firstWord = data.chain.find(item => item.actiontype === 'drawing');
            if (firstWord) {
              console.log('✅ Используем первое доступное слово:', firstWord.word);
              setCurrentWord(firstWord.word);
              setError("");
            } else {
              setError("Слово для рисования еще не распределено");
            }
          } else {
            setError("Цепочка слов не создана. Дождитесь начала раунда.");
          }
        }
      } else {
        console.error('❌ Ошибка получения цепочки');
        setError("Не удалось получить данные игры");
      }
    } catch (error) {
      console.error('❌ Ошибка получения слова:', error);
      setError("Ошибка соединения с сервером");
    }
  }, [roomCode, user]);

  // ✅ ПРАВИЛЬНАЯ ОТПРАВКА РИСУНКА
  const saveDrawing = useCallback(async (drawingData) => {
    if (!roomCode) return false;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/game/${roomCode}/save-drawing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          drawingData: drawingData
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
    if (!roomCode) return false;

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
      console.log('🔄 Загрузка данных игры...');
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/game/${roomCode}`, {
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
          
          setIsLoading(false);
        }
      } else {
        console.error('❌ Ошибка загрузки данных игры');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки данных игры:', error);
      setIsLoading(false);
    }
  }, [roomCode]);

  useEffect(() => {
    console.log('🎨 DrawingPage mounted, roomCode:', roomCode);
    isMountedRef.current = true;
    
    if (roomCode) {
      // Загружаем данные и слово
      const initializeGame = async () => {
        await loadGameData();
        await fetchDrawingWord();
      };
      
      initializeGame();

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

      return () => {
        console.log('🎨 DrawingPage unmounted');
        isMountedRef.current = false;
        clearInterval(timer);
      };
    } else {
      console.error('❌ roomCode не передан в компонент');
      setIsLoading(false);
    }
  }, [roomCode, loadGameData, fetchDrawingWord]);

  const handleTimeUp = useCallback(async () => {
    console.log('🎨 Время вышло, завершаем рисование...');
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('❌ Canvas не найден');
      return;
    }
    
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

  // Функции рисования (без изменений)
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

  const retryLoad = () => {
    setIsLoading(true);
    setError("");
    loadGameData();
    fetchDrawingWord();
  };

  // Состояния загрузки/ошибки
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

  if (error) {
    return (
      <div className="drawing-container error">
        <div className="error-icon">❌</div>
        <div className="error-text">{error}</div>
        <div className="error-details">
          Room ID: {roomCode}<br/>
          Проверьте, что хост запустил этап рисования.
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
        <div className="error-text">Ожидание распределения слов</div>
        <div className="error-details">
          Хост должен запустить этап рисования.<br/>
          Room ID: {roomCode}
        </div>
        <button className="retry-btn" onClick={retryLoad}>
          Проверить снова
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
          <div className="room-info">Комната: {roomCode} | Раунд: {currentRound}/{totalRounds}</div>
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