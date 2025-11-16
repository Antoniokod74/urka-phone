import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import './App.css';
import MainScreen from './pages/MainScreen';
import RegisterWindow from './pages/RegisterWindow';
import LoginWindow from './pages/LoginWindow';
import ChooseGameMode from './pages/ChooseGameMode';
import RoomPage from './pages/RoomPage';
import SettingsWindow from './pages/SettingsWindow';
import { AuthProvider, useAuth } from './context/AuthContext';
import CreateWordsPage from './pages/CreateWordsPage';
import DrawingPage from './pages/DrawingPage';
import GuessingPage from './pages/GuessingPage';
import ResultsPage from './pages/ResultsPage'; // ✅ ДОБАВИЛИ СТРАНИЦУ РЕЗУЛЬТАТОВ

// Компонент для управления навигацией
function AppContent() {
  const [submittedWords, setSubmittedWords] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [userStats, setUserStats] = useState({
    games: 0,
    wins: 0,
    points: 0,
  });

  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, register, logout, isAuthenticated } = useAuth();

  // Определяем, показывать ли модальные окна на основе query параметров
  const showRegister = location.search.includes('modal=register');
  const showLogin = location.search.includes('modal=login');
  const showSettings = location.search.includes('modal=settings');

  useEffect(() => {
    if (showRegister || showLogin || showSettings) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showRegister, showLogin, showSettings]);

  useEffect(() => {
    if (user) {
      setUserStats({
        games: user.gamesplayed || 0,
        wins: user.gameswon || 0,
        points: user.points || 0,
      });
    }
  }, [user]);

  const switchToRegister = () => {
    navigate('?modal=register');
  };

  const switchToLogin = () => {
    navigate('?modal=login');
  };

  const handleLoginSuccess = () => {
    navigate('/');
    setUserStats({ games: 12, wins: 8, points: 450 });
  };

  const handleRegisterSuccess = () => {
    navigate('/');
    setUserStats({ games: 0, wins: 0, points: 0 });
  };

  // Обработка присоединения по коду
  const handleJoinByCode = (code) => {
    navigate(`/room/${code}`);
  };

  // Обработка создания комнаты
  const handleRoomCreated = (roomId) => {
    console.log('🎉 Комната создана, переходим в RoomPage с ID:', roomId);
    navigate(`/room/${roomId}`);
  };

  // Обработчик начала игры - переходит на страницу ввода слов
  const handleStartGame = (roomCode, players) => {
    console.log('🎮 Начинаем игру в комнате:', roomCode, 'Игроки:', players);
    navigate(`/room/${roomCode}/create-words`);
  };

  // Обработчик отправки слов - переходит на страницу рисования
  const handleSubmitWords = (words, roomCode) => {
    console.log('📝 Слова отправлены:', words);
    setSubmittedWords(words);
    navigate(`/room/${roomCode}/drawing`);
  };

  // ✅ ОБНОВЛЕННЫЙ ОБРАБОТЧИК ЗАВЕРШЕНИЯ РИСОВАНИЯ - ПЕРЕХОДИТ НА РЕЗУЛЬТАТЫ
  const handleDrawingComplete = (drawingData, roomCode) => {
    console.log('🎨 Рисунок завершен, переходим к результатам:', drawingData);
    setDrawings(prev => [...prev, {
      id: Date.now(),
      image: drawingData,
      artist: user?.login || 'Игрок',
      originalWord: submittedWords[0] || 'Слово'
    }]);
    
    // ✅ ПЕРЕХОДИМ НА СТРАНИЦУ РЕЗУЛЬТАТОВ ВМЕСТО УГАДЫВАНИЯ
    navigate(`/results/${roomCode}`);
  };

  // ✅ ДОБАВИЛИ ОБРАБОТЧИК ДЛЯ ПЕРЕХОДА НА РЕЗУЛЬТАТЫ ИЗ ДРУГИХ МЕСТ
  const handleShowResults = (roomCode) => {
    console.log('📊 Переходим к результатам комнаты:', roomCode);
    navigate(`/results/${roomCode}`);
  };

  // ✅ ДОБАВИЛИ ОБРАБОТЧИК ДЛЯ НОВОГО РАУНДА
  const handleNewRound = (roomCode) => {
    console.log('🎯 Начинаем новый раунд в комнате:', roomCode);
    navigate(`/room/${roomCode}/create-words`);
  };

  // Обработчик отправки догадки
  const handleSubmitGuess = (guess, drawingIndex) => {
    console.log('🔍 Догадка отправлена:', guess, 'для рисунка:', drawingIndex);
  };

  // Закрыть все модальные окна и вернуться на главный экран
  const closeAllModals = () => {
    navigate('/');
  };

  return (
    <div className="App" style={{ minHeight: '100vh' }}>
      {/* Основные маршруты */}
      <Routes>
        <Route path="/" element={
          <MainScreen
            onLoginClick={() => navigate('?modal=login')}
            onRegisterClick={() => navigate('?modal=register')}
            onSettingsClick={() => navigate('?modal=settings')}
            onStartGameClick={() => navigate('/choose-mode')}
            onCreateRoomClick={() => navigate('/choose-mode')}
            isAuthenticated={isAuthenticated}
            onLogoutClick={logout}
            userStats={userStats}
          />
        } />
        
        <Route path="/choose-mode" element={
          <ChooseGameMode
            onBack={() => navigate('/')}
            onJoinByCode={handleJoinByCode}
            onRoomCreated={handleRoomCreated}
            availableRooms={[]}
            onStartGame={handleStartGame}
          />
        } />

        <Route path="/room/:roomId" element={
          <RoomPage
            onBack={() => navigate('/choose-mode')}
            onStartGame={handleStartGame}
            onShowResults={handleShowResults} // ✅ ДОБАВИЛИ ПЕРЕХОД НА РЕЗУЛЬТАТЫ
          />
        } />

        <Route path="/room/:roomId/create-words" element={
          <CreateWordsPage
            onBack={() => navigate(-1)}
            onSubmitWords={handleSubmitWords}
            players={[]}
          />
        } />

        <Route path="/room/:roomId/drawing" element={
          <DrawingPage
            onBack={() => navigate(-1)}
            onDrawingComplete={handleDrawingComplete}
            words={submittedWords}
            players={[]}
          />
        } />

        <Route path="/room/:roomId/guessing" element={
          <GuessingPage
            onBack={() => navigate(-1)}
            onSubmitGuess={handleSubmitGuess}
            drawings={drawings}
            players={[]}
            onShowResults={handleShowResults} // ✅ ДОБАВИЛИ ПЕРЕХОД НА РЕЗУЛЬТАТЫ
          />
        } />

        {/* ✅ ДОБАВИЛИ МАРШРУТ ДЛЯ СТРАНИЦЫ РЕЗУЛЬТАТОВ */}
        <Route path="/results/:roomId" element={
          <ResultsPage
            onBack={() => navigate(-1)}
            onNewRound={handleNewRound}
            onReturnToLobby={() => navigate('/')}
          />
        } />
      </Routes>

      {/* Модальные окна (показываются поверх любого маршрута) */}
      {showRegister && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.5)'
          }}
        >
          <RegisterWindow
            onSwitchToLogin={switchToLogin}
            onRegisterSuccess={handleRegisterSuccess}
            onHomeClick={closeAllModals}
            onRegister={register}
          />
        </div>
      )}

      {showLogin && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.5)'
          }}
        >
          <LoginWindow
            onSwitchToRegister={switchToRegister}
            onLoginSuccess={handleLoginSuccess}
            onHomeClick={closeAllModals}
            onLogin={login}
          />
        </div>
      )}

      {showSettings && (
        <SettingsWindow onClose={() => navigate('/')} />
      )}
    </div>
  );
}

// Главный компонент App
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;