import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom"; // ✅ ДОБАВЛЕН useParams
import "./CreateWordsPage.css";
import { useAuth } from '../context/AuthContext';

export default function CreateWordsPage({ onSubmitWords, players = [], roomCode }) {
  const navigate = useNavigate();
  const { roomId } = useParams(); // ✅ ПОЛУЧАЕМ roomId ИЗ URL
  const { user } = useAuth();
  const [word, setWord] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameData, setGameData] = useState({});
  
  const timerRef = useRef(null);
  const isMountedRef = useRef(true);

  const wordPrompts = [
    "Космонавт", "Велосипед", "Пирамида", "Бабочка", "Телескоп",
    "Супергерой", "Пингвин", "Радуга", "Замок", "Робот",
    "Динозавр", "Корабль", "Сердце", "Корона", "Дракон"
  ];

  // ✅ УЛУЧШЕННАЯ ПРОВЕРКА - используем roomId из URL если roomCode не пришел
  const getActualRoomCode = useCallback(() => {
    const actualCode = roomCode || roomId;
    console.log('🔍 getActualRoomCode:', { roomCode, roomId, actualCode });
    return actualCode;
  }, [roomCode, roomId]);

  const isValidRoomCode = useCallback(() => {
    const actualCode = getActualRoomCode();
    const isValid = actualCode && actualCode !== 'undefined' && actualCode !== 'null' && actualCode !== '';
    console.log('🔍 isValidRoomCode check:', { actualCode, isValid });
    return isValid;
  }, [getActualRoomCode]);

  // Загрузка данных игры в реальном времени
  const loadGameData = useCallback(async () => {
    const actualRoomCode = getActualRoomCode();
    
    if (!isValidRoomCode()) {
      console.error('❌ Invalid roomCode in loadGameData:', actualRoomCode);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      console.log('🔄 Загружаем данные игры для комнаты:', actualRoomCode);
      
      const response = await fetch(`/api/game/${actualRoomCode}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (isMountedRef.current) {
          setGameData(data);
          
          if (data.room?.timeLeft) {
            setTimeLeft(data.room.timeLeft);
          }
          
          const currentPlayer = data.players?.find(p => p.userid === user?.userid);
          if (currentPlayer?.hasSubmittedWord) {
            setSubmitted(true);
          }
        }
      } else {
        console.error('❌ Ошибка загрузки данных игры:', response.status);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки данных игры:', error);
    }
  }, [getActualRoomCode, isValidRoomCode, user]);

  useEffect(() => {
    const actualRoomCode = getActualRoomCode();
    
    if (!isValidRoomCode()) {
      console.error('❌ Invalid roomCode in useEffect:', actualRoomCode);
      alert('Некорректный ID комнаты. Перезагрузите страницу.');
      navigate('/choose-mode');
      return;
    }

    isMountedRef.current = true;
    
    console.log('🎮 CreateWordsPage mounted with roomCode:', actualRoomCode);
    
    // Загружаем данные игры
    loadGameData();
    
    // Обновляем каждые 2 секунды
    const interval = setInterval(loadGameData, 2000);
    
    // WebSocket для реального времени
    let ws = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/game/${actualRoomCode}`;
      ws = new WebSocket(wsUrl);
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'WORD_SUBMITTED' || data.type === 'TIME_UPDATE') {
          loadGameData();
        }
        
        if (data.type === 'ALL_WORDS_SUBMITTED') {
          if (onSubmitWords) {
            onSubmitWords([word], actualRoomCode);
          }
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
  }, [loadGameData, getActualRoomCode, isValidRoomCode, onSubmitWords, word, navigate]);

  // Таймер на клиенте как fallback
  useEffect(() => {
    if (timeLeft > 0 && !submitted) {
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setTimeLeft(prev => prev - 1);
        }
      }, 1000);
    } else if (timeLeft === 0 && !submitted) {
      handleAutoSubmit();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, submitted]);

  const handleSubmit = async () => {
    const actualRoomCode = getActualRoomCode();
    
    console.log('🎯 handleSubmit called:', {
      roomCode,
      roomId,
      actualRoomCode,
      word: word.trim(),
      isValid: isValidRoomCode()
    });
    
    if (!isValidRoomCode()) {
      console.error('❌ Invalid roomCode in handleSubmit:', actualRoomCode);
      alert('Некорректный ID комнаты. Перезагрузите страницу.');
      return;
    }

    if (word.trim()) {
      try {
        const token = localStorage.getItem('token');
        console.log('🔄 Отправляем слово в комнату:', actualRoomCode);
        
        const response = await fetch(`/api/game/${actualRoomCode}/word`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            word: word.trim()
          })
        });

        if (response.ok) {
          console.log('✅ Слово отправлено на сервер');
          setSubmitted(true);
          if (onSubmitWords) {
            onSubmitWords([word.trim()], actualRoomCode);
          }
        } else {
          const errorText = await response.text();
          console.error('❌ Ошибка отправки слова:', errorText);
          alert('Ошибка отправки слова: ' + errorText);
        }
      } catch (error) {
        console.error('❌ Ошибка:', error);
        alert('Ошибка отправки слова: ' + error.message);
      }
    } else {
      alert("Пожалуйста, введите слово!");
    }
  };

  const handleAutoSubmit = async () => {
    const actualRoomCode = getActualRoomCode();
    
    if (!isValidRoomCode()) {
      console.error('❌ Invalid roomCode in handleAutoSubmit:', actualRoomCode);
      return;
    }

    let finalWord = word.trim();
    if (!finalWord) {
      finalWord = wordPrompts[Math.floor(Math.random() * wordPrompts.length)];
      setWord(finalWord);
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/game/${actualRoomCode}/word`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          word: finalWord
        })
      });

      if (response.ok) {
        setSubmitted(true);
        if (onSubmitWords) {
          onSubmitWords([finalWord], actualRoomCode);
        }
      }
    } catch (error) {
      console.error('❌ Ошибка авто-отправки:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const getPlayerStatus = (player) => {
    if (player.hasSubmittedWord || player.wordSubmitted) {
      return "submitted";
    }
    return player.userid === user?.userid && submitted ? "submitted" : "waiting";
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Используем актуальных игроков из gameData или из пропсов
  const actualPlayers = gameData.players || players;
  const submittedCount = actualPlayers.filter(p => getPlayerStatus(p) === 'submitted').length;
  const allSubmitted = submittedCount === actualPlayers.length && actualPlayers.length > 0;

  const actualRoomCode = getActualRoomCode();

  return (
    <div className="create-words-container">
      <header className="words-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Назад
        </button>
        <div className="words-title">
          <h1>🎯 Придумайте слово для игры</h1>
          <div className="room-info">Комната: {actualRoomCode || 'Загрузка...'}</div>
        </div>
        <div className="timer-section">
          <div className={`timer ${timeLeft <= 10 ? 'urgent' : ''}`}>
            ⏰ {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      <div className="words-content">
        <div className="words-input-panel">
          <div className="input-section">
            <h2>✨ Ваше слово для игры</h2>
            <p className="instruction">
              Придумайте одно интересное слово или фразу. 
              Другие игроки будут это рисовать!
            </p>

            <div className="word-input-container">
              <input
                type="text"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Введите ваше слово..."
                maxLength={30}
                disabled={submitted}
                className="word-input"
              />
              <div className="char-counter">
                {word.length}/30 символов
              </div>
            </div>

            <div className="prompts-section">
              <h3>💡 Примеры хороших слов:</h3>
              <div className="prompts-grid">
                {wordPrompts.map((prompt, index) => (
                  <button
                    key={index}
                    className="prompt-tag"
                    onClick={() => !submitted && setWord(prompt)}
                    disabled={submitted}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="tips-section">
              <h3>🎨 Советы для хорошего слова:</h3>
              <div className="tips-list">
                <div className="tip-item">✅ Легко рисовать</div>
                <div className="tip-item">✅ Понятно для всех</div>
                <div className="tip-item">✅ Не слишком сложное</div>
                <div className="tip-item">✅ Интересное и креативное</div>
              </div>
            </div>

            {!submitted && (
              <button
                onClick={handleSubmit}
                disabled={!word.trim()}
                className={`submit-words-btn ${word.trim() ? 'active' : ''}`}
              >
                🚀 Отправить слово!
              </button>
            )}

            {submitted && (
              <div className="submitted-message">
                <div className="success-icon">✅</div>
                <div className="success-text">
                  <h3>Ваше слово отправлено!</h3>
                  <p>«{word}»</p>
                  <div className="waiting-text">
                    {allSubmitted ? '🎉 Все слова собраны! Начинаем игру...' : 'Ожидаем других игроков...'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="players-status-panel">
          <h2>👥 Статус игроков ({actualPlayers.length})</h2>
          
          <div className="players-list">
            {actualPlayers.map((player) => (
              <div key={player.userid} className="player-status-item">
                <div className="player-avatar">
                  {player.login?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="player-info">
                  <div className="player-name">
                    {player.login}
                    {player.userid === user?.userid && <span className="you-badge">(Вы)</span>}
                  </div>
                  <div className={`status ${getPlayerStatus(player)}`}>
                    {getPlayerStatus(player) === 'submitted' ? '✅ Слово отправлено' : '⏳ Придумывает слово'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="progress-section">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ 
                  width: `${(submittedCount / Math.max(actualPlayers.length, 1)) * 100}%` 
                }}
              ></div>
            </div>
            <div className="progress-text">
              {submittedCount} из {actualPlayers.length} игроков отправили слова
            </div>
          </div>

          {allSubmitted && (
            <div className="all-ready-message">
              <div className="ready-icon">🎉</div>
              <div className="ready-text">
                <h3>Все слова собраны!</h3>
                <p>Скоро начнется рисование...</p>
              </div>
            </div>
          )}

          <div className="rules-section">
            <h3>📝 Как это работает:</h3>
            <ul>
              <li>💬 Каждый пишет по одному слову</li>
              <li>🎨 Потом вы будете рисовать слова других игроков</li>
              <li>🔍 И угадывать что нарисовали другие</li>
              <li>⏱️ У вас есть 1 минута на придумывание</li>
              <li>🚀 После отправки изменить слово нельзя</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}