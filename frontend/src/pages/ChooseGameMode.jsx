import React, { useState, useEffect, useCallback } from "react";
import "./ChooseGameMode.css";
import { useAuth } from '../context/AuthContext';
import { gameAPI, testConnection } from '../api/api';
import { useNavigate } from 'react-router-dom';

const gameModes = [
  {
    id: "classic",
    title: "Классический Gartic Phone",
    description: "Рисуй и угадывай по цепочке. Классические правила игры",
    duration: "15-20 мин",
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
    duration: "25-35 мин",
    players: "4-8 игроков",
    rounds: 5
  },
];

export default function ChooseGameMode({ 
  onBack, 
  onJoinByCode, 
  onCreateRoom,
  onRoomCreated
}) {
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

  // Функция для загрузки доступных комнат
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

  // Функция для проверки подключения к серверу
  const checkServerConnection = useCallback(async () => {
    try {
      await testConnection();
      setError('');
      alert('✅ Сервер подключен!');
      loadAvailableRooms();
    } catch (error) {
      setError('Сервер не подключен. Запустите бэкенд на localhost:5000');
    }
  }, [loadAvailableRooms]);

  // Проверяем подключение при загрузке
  useEffect(() => {
    checkServerConnection();
  }, [checkServerConnection]);

  // Загружаем доступные комнаты при монтировании
  useEffect(() => {
    loadAvailableRooms();
  }, [loadAvailableRooms]);

  const handleCreateRoom = async () => {
    if (!selectedMode) {
      alert("Выберите режим игры");
      return;
    }

    if (!user) {
      alert("Необходимо авторизоваться");
      return;
    }

    try {
      setCreating(true);
      setError('');

      console.log('🔄 Создаем комнату...');
      console.log('🔑 Токен:', localStorage.getItem('token') ? 'Есть' : 'Нет');

      const roomData = {
        title: `Комната ${user.Login}`,
        gamemode: selectedMode,
        maxPlayers: 8,
        totalRounds: 3,
        isPrivate: false,
        password: null
      };

      console.log('📨 Отправляем данные:', roomData);

      const response = await gameAPI.createGame(roomData);

      console.log('✅ Ответ сервера:', response);

      // В функции handleCreateRoom в ChooseGameMode.jsx
      if (response.data && response.data.game) {
        const gameId = response.data.game.gameid;
        console.log(`🎉 Комната создана! ID: ${gameId}`);
        
        // Вызываем колбэк для перехода на страницу комнаты
        if (typeof onRoomCreated === "function") {
          onRoomCreated(gameId);
        }
      }

    } catch (error) {
      console.error('❌ Ошибка создания комнаты:', error);
      alert(`Ошибка создания комнаты: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCodeClick = async () => {
    if (!roomCode.trim()) {
      alert("Введите код комнаты");
      return;
    }

    if (!user) {
      alert("Необходимо авторизоваться");
      return;
    }

    try {
      setLoading(true);
      
      // Переход на страницу комнаты по коду
      navigate(`/room/${roomCode.trim()}`);
      
      // Или если используешь callback
      if (typeof onJoinByCode === "function") {
        onJoinByCode(roomCode.trim());
      }

    } catch (error) {
      console.error('❌ Ошибка присоединения:', error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (roomId) => {
    if (!user) {
      alert("Необходимо авторизоваться");
      return;
    }

    try {
      // Переход на страницу комнаты
      navigate(`/room/${roomId}`);
      
      // Или если используешь callback
      if (typeof onJoinByCode === "function") {
        onJoinByCode(roomId.toString());
      }

    } catch (error) {
      console.error('❌ Ошибка присоединения:', error);
      alert(`Ошибка: ${error.message}`);
    }
  };

  const handleRefresh = () => {
    loadAvailableRooms();
  };

  const getGameModeTitle = (modeId) => {
    const mode = gameModes.find(m => m.id === modeId);
    return mode ? mode.title : modeId;
  };

  return (
    <div className="choose-game-container">
      <div className="choose-game-header">
        <button className="back-button" onClick={onBack}>
          Назад
        </button>
        <h2 className="choose-game-title">Gartic Phone - Выбор игры</h2>
        {user && <div className="user-info">Вы вошли как: {user.login}</div>}
      </div>

      {error && (
        <div className="connection-error">
          ⚠️ {error}
          <button onClick={checkServerConnection} className="retry-btn">
            Проверить подключение
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
                disabled={creating}
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
              <button onClick={handleRefresh} className="refresh-button" disabled={loading}>
                {loading ? '🔄' : '⟳ Обновить'}
              </button>
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
                          🕒 Создана: {new Date(room.createdat).toLocaleString()}
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