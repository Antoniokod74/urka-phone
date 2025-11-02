import React from "react";
import { useNavigate } from 'react-router-dom';
import './MainScreen.css';
import { useAuth } from '../context/AuthContext';

export default function MainScreen() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  
  const userStats = {
    games: user?.gamesplayed || 0,
    wins: user?.gameswon || 0,
    points: user?.points || 0
  };

  return (
    <div className="main-screen">
      <header className="header">
        <div className="logo">Urka Phone</div>
        {isAuthenticated && (
          <div className="user-info">
            <span>Привет, {user?.login}!</span>
            <button className="logout-btn" onClick={logout}>Выйти</button>
          </div>
        )}
      </header>

      <main>
        <h1>Добро пожаловать в игру!</h1>
        <p>Выберите режим игры и начните веселиться с друзьями</p>

        {/* Два блока игры РЯДОМ друг с другом */}
        <div className="game-modes" style={{ 
          display: 'flex', 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          gap: '15px', 
          marginBottom: '25px' 
        }}>
          {/* ЛЕВЫЙ блок - Быстрая игра */}
          <div className="mode quick-game" style={{ 
            flex: 1, 
            minHeight: '220px', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between' 
          }}>
            <div>
              <div className="icon">▶</div>
              <h2>Быстрая игра</h2>
              <p>Присоединиться к случайной комнате или создать новую для друзей</p>
            </div>
            <button className="btn-start" onClick={() => navigate('/choose-mode')}>
              Начать игру
            </button>
          </div>

          {/* ПРАВЫЙ блок - Приватная комната */}
          <div className="mode private-room" style={{ 
            flex: 1, 
            minHeight: '220px', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between' 
          }}>
            <div>
              <div className="icon">👥</div>
              <h2>Приватная комната</h2>
              <p>Создайте закрытую комнату для игры только с приглашенными друзьями</p>
            </div>
            <button className="btn-create" onClick={() => navigate('/choose-mode')}>
              Создать комнату
            </button>
          </div>
        </div>

        {/* Статистика под блоками игры */}
        {isAuthenticated && (
          <div className="stats">
            <div className="stat-item">
              <div className="stat-value">{userStats.games}</div>
              <div className="stat-label">Игр сыграно</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{userStats.wins}</div>
              <div className="stat-label">Побед</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{userStats.points}</div>
              <div className="stat-label">Очков</div>
            </div>
          </div>
        )}

        {/* Кнопки авторизации */}
        {!isAuthenticated && (
          <div className="auth-buttons">
            <button className="main-button" onClick={() => navigate('?modal=login')}>
              Войти
            </button>
            <button className="main-button" onClick={() => navigate('?modal=register')}>
              Регистрация
            </button>
            <button 
              className="settings-button" 
              onClick={() => navigate('?modal=settings')} 
              title="Настройки"
            >
              ⚙
            </button>
          </div>
        )}

        {/* Кнопка настроек для авторизованных */}
        {isAuthenticated && (
          <div className="auth-buttons">
            <button 
              className="settings-button" 
              onClick={() => navigate('?modal=settings')} 
              title="Настройки"
            >
              ⚙
            </button>
          </div>
        )}
      </main>
    </div>
  );
}