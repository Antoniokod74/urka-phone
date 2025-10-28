import React, { useState, useEffect, useCallback } from "react";
import "./RoomPage.css";
import { useAuth } from '../context/AuthContext';

export default function RoomPage({ roomCode = "ROOM1", onBack, onSettings, onStartGame }) {
  const { user } = useAuth();
  const [players, setPlayers] = useState([]);
  const [roomInfo, setRoomInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownNumber, setCountdownNumber] = useState(3);

  // Загрузка данных комнаты и игроков
  const loadRoomData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('🔄 Загружаем данные комнаты:', roomCode);
      
      const response = await fetch(`http://localhost:5000/api/game/${roomCode}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Данные комнаты:', data);
      
      if (!data.room) {
        throw new Error('Некорректный формат данных комнаты');
      }
      
      setRoomInfo(data.room);
      setPlayers(data.players || []);
      setError(''); // Очищаем ошибку при успешной загрузке
      
    } catch (error) {
      console.error('❌ Ошибка загрузки комнаты:', error);
      setError(`Не удалось загрузить данные комнаты: ${error.message}`);
      
      // Используем мок-данные только если комната не найдена (404)
      if (error.message.includes('404') || error.message.includes('не найдена')) {
        console.log('🎮 Используем тестовые данные');
        const mockRoomData = {
          room: {
            gameid: roomCode,
            title: `Комната ${roomCode}`,
            gamemode: 'classic',
            status: 'waiting',
            maxplayers: 8,
            currentplayers: 1,
            currentround: 1,
            totalrounds: 3,
            createdat: new Date().toISOString()
          },
          players: [
            {
              userid: user?.userid || 1,
              login: user?.login || 'Тестовый игрок',
              ishost: true,
              ready: false,
              score: 0
            }
          ]
        };
        setRoomInfo(mockRoomData.room);
        setPlayers(mockRoomData.players);
        setError(''); // Очищаем ошибку при использовании мок-данных
      }
    } finally {
      setLoading(false);
    }
  }, [roomCode, user]);

  useEffect(() => {
    loadRoomData();
    const interval = setInterval(loadRoomData, 3000);
    return () => clearInterval(interval);
  }, [loadRoomData]);

  // Функция для запуска отсчета
  const startCountdown = useCallback(() => {
    setShowCountdown(true);
    setCountdownNumber(3);
    
    const countdownInterval = setInterval(() => {
      setCountdownNumber(prev => {
        if (prev === 1) {
          clearInterval(countdownInterval);
          setTimeout(() => {
            setShowCountdown(false);
            // ПЕРЕХОД НА СТРАНИЦУ ВВОДА СЛОВ
            console.log('🎮 Переходим на страницу ввода слов');
            if (typeof onStartGame === "function") {
              onStartGame(roomCode, players);
            }
          }, 1000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [roomCode, players, onStartGame]);

  const toggleReady = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('🔄 Изменяем статус готовности для комнаты:', roomCode);
      
      const response = await fetch(`http://localhost:5000/api/game/${roomCode}/ready`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка изменения статуса готовности');
      }

      const result = await response.json();
      console.log('✅ Статус готовности изменен:', result);
      
      // Перезагружаем данные после изменения
      await loadRoomData();
      
    } catch (error) {
      console.error('❌ Ошибка:', error);
      alert(`Не удалось изменить статус готовности: ${error.message}`);
      
      // Локально меняем статус если эндпоинт не работает
      const updatedPlayers = players.map(player => 
        player.userid === user?.userid 
          ? { ...player, ready: !player.ready }
          : player
      );
      setPlayers(updatedPlayers);
    }
  };

  const startGame = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('🎮 Начинаем игру для комнаты:', roomCode);
      
      const response = await fetch(`http://localhost:5000/api/game/${roomCode}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Не удалось начать игру');
      }

      const result = await response.json();
      console.log('✅ Игра начата:', result);
      
      // Запускаем красивый отсчет вместо обычного alert
      startCountdown();
      
    } catch (error) {
      console.error('❌ Ошибка начала игры:', error);
      alert(`Не удалось начать игру: ${error.message}`);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      alert("Код комнаты скопирован!");
    }).catch(() => {
      alert("Не удалось скопировать код комнаты");
    });
  };

  const handleRefresh = () => {
    setLoading(true);
    loadRoomData();
  };

  if (loading) {
    return (
      <div className="room-page-container">
        <div className="loading-message">🔄 Загрузка данных комнаты...</div>
      </div>
    );
  }

  if (error && !roomInfo) {
    return (
      <div className="room-page-container">
        <div className="error-message">❌ {error}</div>
        <button onClick={onBack} className="back-button">Назад к выбору игры</button>
        <button onClick={handleRefresh} className="refresh-button">Повторить попытку</button>
      </div>
    );
  }

  if (!roomInfo) {
    return (
      <div className="room-page-container">
        <div className="error-message">❌ Комната не найдена</div>
        <button onClick={onBack} className="back-button">Назад к выбору игры</button>
      </div>
    );
  }

  // Определяем текущего пользователя в списке игроков
  const currentPlayer = players.find(p => p.userid === user?.userid);
  const youReady = currentPlayer?.ready || false;
  const youAreHost = currentPlayer?.ishost || false;

  const totalPlayers = roomInfo.maxplayers || 8;
  const currentPlayers = roomInfo.currentplayers || players.length;
  const readyCount = players.filter(p => p.ready).length;
  const allReady = players.length > 0 && players.every(p => p.ready);

  return (
    <>
      {/* Полноэкранный отсчет */}
      {showCountdown && (
        <div className="countdown-overlay">
          <div className="countdown-container">
            <div className={`countdown-number ${countdownNumber === 0 ? 'go' : ''}`}>
              {countdownNumber === 0 ? "LET'S GOOOO!" : countdownNumber}
            </div>
            <div className="countdown-background"></div>
          </div>
        </div>
      )}

      <div className="room-page-container">
        <header className="room-header">
          <button className="back-button" title="Назад" onClick={onBack}>
            ← Назад
          </button>
          <div className="room-title">
            <h2>{roomInfo.title || `Комната ${roomCode}`}</h2>
            <div className="subheading">
              {roomInfo.status === 'waiting' ? '🟢 Ожидание игроков...' : 
               roomInfo.status === 'playing' ? '🎮 Игра идет' : '🏁 Игра завершена'}
            </div>
          </div>
          <div className="step-indicator">
            <div className="circle">1</div>
          </div>
          <button className="settings-button" title="Настройки" onClick={onSettings}>
            ⚙
          </button>
        </header>

        {error && (
          <div className="connection-error">
            ⚠️ {error}
            <button onClick={handleRefresh} className="retry-btn">
              Обновить
            </button>
          </div>
        )}

        <div className="room-content">
          <div className="room-info-panel">
            <h3>📊 Информация о комнате</h3>
            <div className="room-info-row">
              <span>Код комнаты:</span>
              <span className="code">
                {roomCode}
                <button className="copy-btn" title="Копировать" onClick={copyRoomCode}>
                  📋
                </button>
              </span>
            </div>
            <div className="room-info-row">
              <span>Режим игры:</span>
              <span>{roomInfo.gamemode || 'Классический'}</span>
            </div>
            <div className="room-info-row">
              <span>Игроков:</span>
              <span>👥 {currentPlayers}/{totalPlayers}</span>
            </div>
            <div className="room-info-row">
              <span>Готовы:</span>
              <span className="ready-count" style={{ color: readyCount > 0 ? "green" : "inherit" }}>
                {readyCount}/{currentPlayers}
              </span>
            </div>
            <div className="room-info-row">
              <span>Раунды:</span>
              <span>{roomInfo.currentround || 1}/{roomInfo.totalrounds || 3}</span>
            </div>
            {roomInfo.hostname && (
              <div className="room-info-row">
                <span>Создатель:</span>
                <span>👑 {roomInfo.hostname}</span>
              </div>
            )}
          </div>

          <div className="players-panel">
            <div className="players-header">
              <h3>👥 Игроки ({currentPlayers}/{totalPlayers})</h3>
              <button onClick={handleRefresh} className="refresh-btn" title="Обновить">
                🔄
              </button>
            </div>

            <div className="players-grid">
              {players.map((player) => (
                <div key={player.userid} className={`player-card ${player.ishost ? 'host' : ''}`}>
                  <div className="player-main">
                    <div className="avatar">
                      {player.login?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="player-info">
                      <div className="player-name">
                        {player.login}
                        {player.ishost && <span className="host-badge">👑 Хост</span>}
                        {player.userid === user?.userid && <span className="you-label">(Вы)</span>}
                      </div>
                      <div className={`player-status ${player.ready ? 'ready' : 'not-ready'}`}>
                        {player.ready ? "✅ Готов" : "❌ Не готов"}
                      </div>
                      <div className="player-score">
                        🏆 Очки: {user?.points || 0}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {[...Array(totalPlayers - currentPlayers)].map((_, i) => (
                <div key={`empty-${i}`} className="player-card empty-slot">
                  <div className="empty-text">⏳ Ожидание игрока...</div>
                </div>
              ))}
            </div>

            {/* КНОПКА ГОТОВНОСТИ ДЛЯ ВСЕХ ИГРОКОВ (ВКЛЮЧАЯ ХОСТА) */}
            {roomInfo.status === 'waiting' && currentPlayer && (
              <div className="ready-section">
                <button
                  className={`ready-button ${youReady ? "ready" : "not-ready"}`}
                  onClick={toggleReady}
                >
                  {youReady ? "❌ Отменить готовность" : "✅ Готов к игре"}
                </button>
                <div className="ready-hint">
                  {youAreHost 
                    ? "Как хост, вы тоже должны быть готовы чтобы начать игру" 
                    : "Нажмите когда будете готовы начать игру"}
                </div>
              </div>
            )}

            {/* Кнопка начала игры для хоста */}
            {youAreHost && roomInfo.status === 'waiting' && (
              <button 
                className={`play-button ${allReady ? 'active' : 'disabled'}`}
                onClick={startGame}
                disabled={!allReady}
              >
                {allReady ? '🎮 Начать игру!' : `Ждем готовности всех игроков (${readyCount}/${currentPlayers})`}
              </button>
            )}

            {roomInfo.status === 'playing' && (
              <div className="game-started-message">
                🎮 Игра уже началась! Ожидайте следующего раунда...
              </div>
            )}

            {roomInfo.status === 'finished' && (
              <div className="game-finished-message">
                🏁 Игра завершена!
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}