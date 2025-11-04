import React, { useState, useEffect, useCallback } from "react";
import "./ChooseGameMode.css";
import { useAuth } from '../context/AuthContext';
import { gameAPI, testConnection } from '../api/api';
import { useNavigate } from 'react-router-dom';

const gameModes = [
  {
    id: "classic",
    title: "Классический Urka Phone",
    description: "Рисуй и угадывай по цепочке. Классические правила игры",
    duration: "10-12 мин",
    players: "4-8 игроков",
    rounds: 3
  },
  {
    id: "fast",
    title: "Быстрая игра",
    description: "Укороченная версия с быстрыми раундами",
    duration: "8-10 мин",
    players: "3-6 игроков",
    rounds: 2
  },
  {
    id: "marathon",
    title: "Марафон",
    description: "Больше раундов, больше веселья!",
    duration: "12-15 мин",
    players: "4-8 игроков",
    rounds: 5
  },
];

export default function ChooseGameMode() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState("classic");
  const [roomCode, setRoomCode] = useState("");
  const [isPrivateRoom, setIsPrivateRoom] = useState(false);
  const [roomPassword, setRoomPassword] = useState("");
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [gameData, setGameData] = useState({});

  // Загрузка доступных комнат
  const loadAvailableRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await gameAPI.getActiveRooms();
      console.log('📊 Active rooms response:', response);
      setAvailableRooms(response.data.rooms || []);
    } catch (error) {
      console.error('❌ Ошибка загрузки комнат:', error);
      setError('Не удалось загрузить список активных комнат: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Проверка подключения к серверу
  const checkServerConnection = useCallback(async () => {
    try {
      await testConnection();
      setError('');
      loadAvailableRooms();
    } catch (error) {
      setError('Сервер не подключен. Запустите бэкенд на localhost:5000');
    }
  }, [loadAvailableRooms]);

  // WebSocket для обновления комнат в реальном времени
  useEffect(() => {
    let ws = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/rooms`;
      ws = new WebSocket(wsUrl);
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ROOMS_UPDATE') {
          loadAvailableRooms();
        }
      };
    } catch (error) {
      console.log('WebSocket не поддерживается для комнат');
    }

    return () => {
      if (ws) ws.close();
    };
  }, [loadAvailableRooms]);

  useEffect(() => {
    checkServerConnection();
  }, [checkServerConnection]);

  useEffect(() => {
    loadAvailableRooms();
    
    // Интервал для обновления комнат каждые 5 секунд
    const interval = setInterval(loadAvailableRooms, 5000);
    return () => clearInterval(interval);
  }, [loadAvailableRooms]);

  const handleCreateRoom = async () => {
    if (!selectedMode) {
      setError("Выберите режим игры");
      return;
    }

    if (!user) {
      setError("Необходимо авторизоваться");
      navigate('?modal=login');
      return;
    }

    try {
      setCreating(true);
      setError('');

      console.log('🔄 Создаем комнату...');

      const roomData = {
        title: `Комната ${user.login || 'пользователя'}`,
        gamemode: selectedMode,
        maxPlayers: 8,
        totalRounds: gameModes.find(mode => mode.id === selectedMode)?.rounds || 3,
        isPrivate: isPrivateRoom,
        password: isPrivateRoom ? roomPassword : null
      };

      console.log('📨 Отправляем данные:', roomData);

      const response = await gameAPI.createGame(roomData);

      console.log('✅ Ответ сервера:', response);

      if (response.data && response.data.game) {
        const gameId = response.data.game.gameid;
        console.log(`🎉 Комната создана! ID: ${gameId}`);
        
        // Переходим в созданную комнату
        navigate(`/room/${gameId}`);
      }

    } catch (error) {
      console.error('❌ Ошибка создания комнаты:', error);
      setError(`Ошибка создания комнаты: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCodeClick = async () => {
    if (!roomCode.trim()) {
      setError("Введите код комнаты");
      return;
    }

    if (!user) {
      setError("Необходимо авторизоваться");
      navigate('?modal=login');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Проверяем существование комнаты перед переходом
      const response = await gameAPI.getRoom(roomCode.trim());
      
      if (response.data && response.data.room) {
        // Переход на страницу комнаты по коду
        navigate(`/room/${roomCode.trim()}`);
      } else {
        setError('Комната не найдена');
      }

    } catch (error) {
      console.error('❌ Ошибка присоединения:', error);
      setError(`Ошибка присоединения: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (roomId) => {
    if (!user) {
      setError("Необходимо авторизоваться");
      navigate('?modal=login');
      return;
    }

    try {
      setError('');
      setLoading(true);
      
      // Проверяем комнату перед присоединением
      const response = await gameAPI.getRoom(roomId);
      
      if (response.data && response.data.room) {
        // Присоединяемся к комнате
        const joinResponse = await gameAPI.joinRoom(roomId);
        
        if (joinResponse.data.success) {
          // Переход на страницу комнаты
          navigate(`/room/${roomId}`);
        } else {
          setError('Не удалось присоединиться к комнате');
        }
      } else {
        setError('Комната не найдена');
      }

    } catch (error) {
      console.error('❌ Ошибка присоединения:', error);
      setError(`Ошибка присоединения: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setError('');
    loadAvailableRooms();
  };

  const getGameModeTitle = (modeId) => {
    const mode = gameModes.find(m => m.id === modeId);
    return mode ? mode.title : modeId;
  };

  const handleQuickJoin = async () => {
    if (!user) {
      navigate('?modal=login');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Находим первую доступную комнату
      const availableRoom = availableRooms.find(room => 
        room.status === 'waiting' && 
        room.currentplayers < room.maxplayers
      );

      if (availableRoom) {
        await handleJoinRoom(availableRoom.gameid);
      } else {
        // Если нет доступных комнат, создаем новую
        await handleCreateRoom();
      }
    } catch (error) {
      console.error('❌ Ошибка быстрого присоединения:', error);
      setError('Ошибка быстрого присоединения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="choose-game-container">
      <div className="choose-game-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          Назад
        </button>
        <h2 className="choose-game-title">Gartic Phone - Выбор игры</h2>
        {user && <div className="user-info">Вы вошли как: {user.login}</div>}
      </div>

      {error && (
        <div className="connection-error">
          ⚠️ {error}
          <button onClick={handleRefresh} className="retry-btn">
            Повторить попытку
          </button>
        </div>
      )}

      <div className="choose-game-content">
        <div className="game-modes">
          <p className="section-title">Выберите режим игры</p>
          <div className="game-modes-list">
            {gameModes.map((mode) => (
              <div
                key={mode.id}
                onClick={() => setSelectedMode(mode.id)}
                className={`game-mode-card ${selectedMode === mode.id ? "selected" : ""}`}
              >
                <h3>{mode.title}</h3>
                <p className="description">{mode.description}</p>
                <div className="mode-info">
                  <span>🕒 {mode.duration}</span>
                  <span>👥 {mode.players}</span>
                  <span>🔁 {mode.rounds} раундов</span>
                </div>
                {selectedMode === mode.id && (
                  <div className="selected-indicator">✅ Выбрано</div>
                )}
              </div>
            ))}
          </div>

          {/* Кнопка быстрого присоединения */}
          <div className="quick-join-section">
            <button 
              className="quick-join-btn"
              onClick={handleQuickJoin}
              disabled={loading || creating}
            >
              🎯 Быстрое присоединение
            </button>
            <p className="quick-join-hint">
              {user ? 'Автоматически найдет доступную комнату или создаст новую' : 'Требуется авторизация'}
            </p>
          </div>

          {!user ? (
            <div className="auth-warning">
              ⚠️ Для создания комнаты необходимо авторизоваться
            </div>
          ) : (
            <>
              <div className="selected-mode-info">
                <strong>Выбран режим:</strong> {getGameModeTitle(selectedMode)}
              </div>

              <div className="room-settings">
                <div className="private-room-toggle">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={isPrivateRoom}
                      onChange={(e) => setIsPrivateRoom(e.target.checked)}
                      className="toggle-input"
                    />
                    <span className="toggle-slider"></span>
                    <span className="toggle-text">Приватная комната</span>
                  </label>
                </div>

                {isPrivateRoom && (
                  <div className="password-input">
                    <input
                      type="password"
                      value={roomPassword}
                      onChange={(e) => setRoomPassword(e.target.value)}
                      placeholder="Введите пароль для комнаты (минимум 4 символа)"
                      className="password-field"
                      minLength={4}
                    />
                    <p className="password-hint">🔒 Пароль потребуется для входа в комнату</p>
                  </div>
                )}
              </div>

              <button 
                className="create-room-btn" 
                onClick={handleCreateRoom}
                disabled={creating || (isPrivateRoom && roomPassword.length < 4)}
              >
                {creating ? 'Создание...' : "🎮 Создать игровую комнату"}
              </button>
            </>
          )}
        </div>

        <div className="right-panel">
          <div className="join-by-code">
            <h3>🎯 Присоединиться по коду</h3>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="Введите ID комнаты"
              disabled={!user}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinByCodeClick()}
            />
            <button 
              onClick={handleJoinByCodeClick} 
              disabled={!user || loading || !roomCode.trim()}
            >
              {loading ? 'Загрузка...' : 'Присоединиться'}
            </button>
            {!user && <p className="auth-hint">⚠️ Требуется авторизация</p>}
          </div>

          <div className="active-rooms">
            <div className="rooms-header">
              <h3>🎪 Активные комнаты ({availableRooms.length})</h3>
              <div className="rooms-controls">
                <span className="live-indicator">● Live</span>
                <button onClick={handleRefresh} className="refresh-button" disabled={loading}>
                  {loading ? '🔄' : '⟳ Обновить'}
                </button>
              </div>
            </div>
            
            {loading ? (
              <div className="loading-message">🔄 Загрузка активных комнат...</div>
            ) : availableRooms.length > 0 ? (
              <div className="rooms-list">
                {availableRooms.map((room) => (
                  <div key={room.gameid} className="room-card">
                    <div className="room-info">
                      <div className="room-header">
                        <strong>{room.title || `Комната #${room.gameid}`}</strong>
                        <span className={`room-status ${room.status === 'waiting' ? 'active' : 'playing'}`}>
                          {room.status === 'waiting' ? '🟢 Ожидание' : 
                           room.status === 'playing' ? '🎮 Играется' : room.status}
                        </span>
                      </div>
                      <div className="room-details">
                        <div className="room-mode">
                          🎯 Режим: {getGameModeTitle(room.gamemode)}
                        </div>
                        <div className="room-players">
                          👥 Игроков: {room.currentplayers}/{room.maxplayers}
                        </div>
                        <div className="room-time">
                          🕒 Создана: {new Date(room.createdat).toLocaleTimeString()}
                        </div>
                        {room.isprivate && <div className="room-private">🔒 Приватная</div>}
                        {room.hostname && <div className="room-host">👑 Хост: {room.hostname}</div>}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleJoinRoom(room.gameid)}
                      className="join-button"
                      disabled={!user || room.status !== 'waiting' || room.currentplayers >= room.maxplayers}
                    >
                      {!user ? 'Войти' : 
                       room.status === 'waiting' ? 
                       (room.currentplayers >= room.maxplayers ? 'Полная' : 'Войти') : 
                       'Играется'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-rooms-message">
                🏜️ Нет активных комнат. Создайте новую комнату и пригласите друзей!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}