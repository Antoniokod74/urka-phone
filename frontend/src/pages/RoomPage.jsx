import React, { useState, useEffect, useCallback, useRef } from "react";
import "./RoomPage.css";
import { useAuth } from '../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';

function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [players, setPlayers] = useState([]);
  const [roomInfo, setRoomInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownNumber, setCountdownNumber] = useState(3);

  const isLoadingRef = useRef(false);
  const mountedRef = useRef(true);
  const hasJoinedRef = useRef(false); // ✅ Следим за тем присоединились ли мы

  const loadRoomData = useCallback(async () => {
    if (!roomId || roomId === 'undefined' || roomId === 'null' || roomId === '') {
      console.error('❌ Invalid roomId in RoomPage:', roomId);
      if (mountedRef.current) {
        setError('Некорректный ID комнаты');
        setLoading(false);
      }
      return;
    }

    if (isLoadingRef.current || !mountedRef.current) return;
    
    isLoadingRef.current = true;
    try {
      const token = localStorage.getItem('token');
      console.log('🔄 Загружаем данные комнаты:', roomId);
      
      const response = await fetch(`/api/game/${roomId}`, {
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
      
      if (mountedRef.current) {
        setRoomInfo(data.room);
        setPlayers(data.players || []);
        setError('');
      }
      
    } catch (error) {
      console.error('❌ Ошибка загрузки комнаты:', error);
      
      if (mountedRef.current) {
        setError(`Не удалось загрузить данные комнаты: ${error.message}`);
        
        if (error.message.includes('404') || error.message.includes('не найдена')) {
          console.log('🎮 Используем тестовые данные');
          const mockRoomData = {
            room: {
              gameid: roomId,
              title: `Комната ${roomId}`,
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
          setError('');
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      isLoadingRef.current = false;
    }
  }, [roomId, user]);

  const joinRoomAutomatically = useCallback(async () => {
    if (!roomId || !user || hasJoinedRef.current) return;
    
    try {
      const token = localStorage.getItem('token');
      console.log('🎯 Автоматическое присоединение к комнате:', roomId);
      
      const response = await fetch(`/api/game/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (response.ok) {
        console.log('✅ Успешно присоединились к комнате');
        hasJoinedRef.current = true; // ✅ Помечаем что присоединились
        // Перезагружаем данные комнаты после присоединения
        setTimeout(loadRoomData, 500);
      } else {
        const errorData = await response.json();
        console.error('❌ Ошибка присоединения:', errorData);
      }
    } catch (error) {
      console.error('❌ Ошибка автоматического присоединения:', error);
    }
  }, [roomId, user, loadRoomData]);

  useEffect(() => {
    mountedRef.current = true;
    hasJoinedRef.current = false; // ✅ Сбрасываем при монтировании
    
    // Первоначальная загрузка
    loadRoomData();
    
    // ✅ УВЕЛИЧИВАЕМ ЧАСТОТУ ОБНОВЛЕНИЯ - КАЖДУЮ СЕКУНДУ
    const interval = setInterval(loadRoomData, 1000);
    
    // ✅ УЛУЧШАЕМ АВТОМАТИЧЕСКОЕ ПРИСОЕДИНЕНИЕ
    const autoJoinTimeout = setTimeout(() => {
      if (user && roomId) {
        const isPlayerInRoom = players.some(p => p.userid === user.userid);
        if (!isPlayerInRoom && roomInfo?.status === 'waiting') {
          console.log('⏰ Автоматическое присоединение по таймауту');
          joinRoomAutomatically();
        }
      }
    }, 2000);

    // ✅ ДОБАВЛЯЕМ РЕЗЕРВНОЕ ПРИСОЕДИНЕНИЕ
    const backupJoinTimeout = setTimeout(() => {
      if (user && roomId && !hasJoinedRef.current) {
        console.log('🔄 Резервное присоединение к комнате');
        joinRoomAutomatically();
      }
    }, 5000);

    // ✅ ОТКЛЮЧАЕМ WEBSOCKET ИЗ-ЗА ОШИБОК
    // WebSocket вызывает ошибки, поэтому временно отключаем
    /*
    let ws = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/game/${roomId}`;
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket подключен');
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket сообщение:', data);
        
        if (data.type === 'PLAYER_JOINED' || data.type === 'PLAYER_LEFT' || data.type === 'PLAYER_READY') {
          loadRoomData();
        }
        
        if (data.type === 'GAME_STARTED') {
          startCountdown();
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket ошибка:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket отключен');
      };
    } catch (error) {
      console.log('WebSocket не поддерживается, используем polling');
    }
    */

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      clearTimeout(autoJoinTimeout);
      clearTimeout(backupJoinTimeout);
      // if (ws) {
      //   ws.close();
      // }
    };
  }, [loadRoomData, roomId, roomInfo, players, user, joinRoomAutomatically]);

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
            navigate(`/room/${roomId}/create-words`);
          }, 1000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [roomId, navigate]);

  const toggleReady = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('🔄 Изменяем статус готовности для комнаты:', roomId);
      
      const response = await fetch(`/api/game/${roomId}/ready`, {
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
      
      await loadRoomData();
      
    } catch (error) {
      console.error('❌ Ошибка:', error);
      alert(`Не удалось изменить статус готовности: ${error.message}`);
      
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
      console.log('🎮 Начинаем игру для комнаты:', roomId);
      
      const response = await fetch(`/api/game/${roomId}/start`, {
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
      
      startCountdown();
      
    } catch (error) {
      console.error('❌ Ошибка начала игры:', error);
      alert(`Не удалось начать игру: ${error.message}`);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      alert("Код комнаты скопирован!");
    }).catch(() => {
      alert("Не удалось скопировать код комнаты");
    });
  };

  const handleRefresh = () => {
    setLoading(true);
    loadRoomData();
  };

  const handleBack = () => {
    navigate('/choose-mode');
  };

  // ✅ ДОБАВЛЯЕМ ФУНКЦИЮ ДЛЯ РУЧНОГО ПРИСОЕДИНЕНИЯ
  const handleManualJoin = async () => {
    await joinRoomAutomatically();
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
        <button onClick={handleBack} className="back-button">Назад к выбору игры</button>
        <button onClick={handleRefresh} className="refresh-button">Повторить попытку</button>
      </div>
    );
  }

  if (!roomInfo) {
    return (
      <div className="room-page-container">
        <div className="error-message">❌ Комната не найдена</div>
        <button onClick={handleBack} className="back-button">Назад к выбору игры</button>
      </div>
    );
  }

  const currentPlayer = players.find(p => p.userid === user?.userid);
  const youReady = currentPlayer?.ready || false;
  const youAreHost = currentPlayer?.ishost || false;

  const totalPlayers = roomInfo.maxplayers || 8;
  const currentPlayers = roomInfo.currentplayers || players.length;
  const readyCount = players.filter(p => p.ready).length;
  const allReady = players.length > 0 && players.every(p => p.ready);

  return (
    <>
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
          <button className="back-button" title="Назад" onClick={handleBack}>
            ← Назад
          </button>
          <div className="room-title">
            <h2>{roomInfo.title || `Комната ${roomId}`}</h2>
            <div className="subheading">
              {roomInfo.status === 'waiting' ? '🟢 Ожидание игроков...' : 
               roomInfo.status === 'playing' ? '🎮 Игра идет' : '🏁 Игра завершена'}
            </div>
          </div>
          <div className="step-indicator">
            <div className="circle">1</div>
          </div>
          <button className="settings-button" title="Настройки" onClick={() => navigate('?modal=settings')}>
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
                {roomId}
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
              <div className="connection-status">
                <span className="live-indicator">●</span> Live
              </div>
            </div>

            {/* ✅ ДОБАВЛЯЕМ КНОПКУ РУЧНОГО ПРИСОЕДИНЕНИЯ */}
            {!currentPlayer && roomInfo.status === 'waiting' && (
              <div className="join-manual-section">
                <button 
                  className="join-manual-button"
                  onClick={handleManualJoin}
                >
                  🎯 Присоединиться к игре
                </button>
                <div className="join-hint">
                  Нажмите чтобы появиться в списке игроков
                </div>
              </div>
            )}

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

export default RoomPage;