import React, { useState, useEffect } from "react";
import "./CreateWordsPage.css";
import { useAuth } from '../context/AuthContext';

export default function CreateWordsPage({ onBack, onSubmitWords, players = [], roomCode }) {
  const { user } = useAuth();
  const [word, setWord] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60); // 60 секунд на ввод слова

  // Список подсказок для вдохновения
  const wordPrompts = [
    "Космонавт", "Велосипед", "Пирамида", "Бабочка", "Телескоп",
    "Супергерой", "Пингвин", "Радуга", "Замок", "Робот",
    "Динозавр", "Корабль", "Сердце", "Корона", "Дракон"
  ];

  // Таймер обратного отсчета
  useEffect(() => {
    if (timeLeft > 0 && !submitted) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !submitted) {
      handleAutoSubmit();
    }
  }, [timeLeft, submitted]);

  const handleSubmit = () => {
    if (word.trim()) {
      setSubmitted(true);
      if (onSubmitWords) {
        onSubmitWords([word.trim()], roomCode); // Добавлен roomCode
      }
    } else {
      alert("Пожалуйста, введите слово!");
    }
  };

  const handleAutoSubmit = () => {
    let finalWord = word.trim();
    if (!finalWord) {
      // Если слово пустое, берем случайное из подсказок
      finalWord = wordPrompts[Math.floor(Math.random() * wordPrompts.length)];
      setWord(finalWord);
    }
    setSubmitted(true);
    if (onSubmitWords) {
      onSubmitWords([finalWord], roomCode); // Добавлен roomCode
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const getPlayerStatus = (player) => {
    return player.userid === user?.userid && submitted ? "submitted" : "waiting";
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="create-words-container">
      {/* Шапка */}
      <header className="words-header">
        <button className="back-button" onClick={onBack}>
          ← Назад
        </button>
        <div className="words-title">
          <h1>🎯 Придумайте слово для игры</h1>
          <div className="room-info">Комната: {roomCode}</div>
        </div>
        <div className="timer-section">
          <div className={`timer ${timeLeft <= 10 ? 'urgent' : ''}`}>
            ⏰ {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      <div className="words-content">
        {/* Левая панель - ввод слова */}
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
            </div>

            {/* Примеры слов */}
            <div className="prompts-section">
              <h3>💡 Примеры хороших слов:</h3>
              <div className="prompts-grid">
                {wordPrompts.map((prompt, index) => (
                  <span key={index} className="prompt-tag">
                    {prompt}
                  </span>
                ))}
              </div>
            </div>

            {/* Советы */}
            <div className="tips-section">
              <h3>🎨 Советы для хорошего слова:</h3>
              <div className="tips-list">
                <div className="tip-item">✅ Легко рисовать</div>
                <div className="tip-item">✅ Понятно для всех</div>
                <div className="tip-item">✅ Не слишком сложное</div>
                <div className="tip-item">✅ Интересное и креативное</div>
              </div>
            </div>

            {/* Кнопка отправки */}
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
                  <div className="waiting-text">Ожидаем других игроков...</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Правая панель - статус игроков */}
        <div className="players-status-panel">
          <h2>👥 Статус игроков</h2>
          
          <div className="players-list">
            {players.map((player) => (
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

          {/* Прогресс-бар */}
          <div className="progress-section">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ 
                  width: `${(players.filter(p => getPlayerStatus(p) === 'submitted').length / Math.max(players.length, 1)) * 100}%` 
                }}
              ></div>
            </div>
            <div className="progress-text">
              {players.filter(p => getPlayerStatus(p) === 'submitted').length} из {players.length} игроков отправили слова
            </div>
          </div>

          {/* Правила */}
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