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

  // Загрузка доступных комнат
  const loadAvailableRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await gameAPI.getActiveRooms();
      setAvailableRooms(response.data.rooms || []);
    } catch (error) {
      console.error('❌ Ошибка загрузки комнат:', error);
      setError('Не удалось загрузить список активных комнат');
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
      setError('Сервер не подключен');
    }
  }, [loadAvailableRooms]);

  useEffect(() => {
    checkServerConnection();
  }, [checkServerConnection]);

  useEffect(() => {
    loadAvailableRooms();
    
    // Интервал для обновления комнат
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
      return;
    }

    try {
      setCreating(true);
      setError('');

      const roomData = {
        title: `Комната ${user.login || 'пользователя'}`,
        gamemode: selectedMode,
        maxPlayers: 8,
        totalRounds: 3,
        isPrivate: isPrivateRoom,
        password: isPrivateRoom ? roomPassword : null
      };

      const response = await gameAPI.createGame(roomData);

      if (response.data && response.data.game) {
        const gameId = response.data.game.gameid;
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
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Переход на страницу комнаты по коду
      navigate(`/room/${roomCode.trim()}`);

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
      return;
    }

    try {
      setError('');
      // Переход на страницу комнаты
      navigate(`/room/${roomId}`);

    } catch (error) {
      console.error('❌ Ошибка присоединения:', error);
      setError(`Ошибка присоединения: ${error.message}`);
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

  return (
    <div className="choose-game-container">
      <div className="choose-game-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Назад
        </button>
        <h2 className="choose-game-title">Urka Phone - Выбор игры</h2>
        {user && <div className="user-info">Вы вошли как: {user.login}</div>}
      </div>

      {error && (
        <div className="connection-error">
          ⚠️ {error}
          <button onClick={handleRefresh} className="retry-btn">
            Обновить
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
                      placeholder="Введите пароль для комнаты"
                      className="password-field"
                    />
                  </div>
                )}
              </div>

              <button 
                className="create-room-btn" 
                onClick={handleCreateRoom}
                disabled={creating}
              >
                {creating ? 'Создание...' : "🎮 Создать комнату"}
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
              <button onClick={handleRefresh} className="refresh-button" disabled={loading}>
                {loading ? '🔄' : '⟳'}
              </button>
            </div>
            
            {loading ? (
              <div className="loading-message">Загрузка комнат...</div>
            ) : availableRooms.length > 0 ? (
              <div className="rooms-list">
                {availableRooms.map((room) => (
                  <div key={room.gameid} className="room-card">
                    <div className="room-info">
                      <div className="room-header">
                        <strong>{room.title || `Комната #${room.gameid}`}</strong>
                        <span className={`room-status ${room.status === 'waiting' ? 'active' : 'playing'}`}>
                          {room.status === 'waiting' ? '🟢 Ожидание' : '🎮 Играется'}
                        </span>
                      </div>
                      <div className="room-details">
                        <div className="room-mode">
                          🎯 Режим: {getGameModeTitle(room.gamemode)}
                        </div>
                        <div className="room-players">
                          👥 Игроков: {room.currentplayers}/{room.maxplayers}
                        </div>
                        {room.isprivate && <div className="room-private">🔒 Приватная</div>}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleJoinRoom(room.gameid)}
                      className="join-button"
                      disabled={!user || room.status !== 'waiting' || room.currentplayers >= room.maxplayers}
                    >
                      {room.status === 'waiting' ? 
                       (room.currentplayers >= room.maxplayers ? 'Полная' : 'Войти') : 
                       'Играется'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-rooms-message">
                Нет активных комнат
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}