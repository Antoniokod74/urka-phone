import React, { useState, useEffect } from 'react';
import './App.css';
import MainScreen from './pages/MainScreen';
import RegisterWindow from './pages/RegisterWindow';
import LoginWindow from './pages/LoginWindow';
import ChooseGameMode from './pages/ChooseGameMode';
import RoomPage from './pages/RoomPage';
import SettingsWindow from './pages/SettingsWindow';
import { useAuth } from './context/AuthContext';
import CreateWordsPage from './pages/CreateWordsPage';
import DrawingPage from './pages/DrawingPage';
import GuessingPage from './pages/GuessingPage'; // Добавляем импорт страницы угадывания

function App() {
  const [showRegister, setShowRegister] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChooseGame, setShowChooseGame] = useState(false);
  const [showRoom, setShowRoom] = useState(false);
  const [showCreateWords, setShowCreateWords] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
  const [showGuessing, setShowGuessing] = useState(false); // Добавляем состояние для страницы угадывания
  const [roomCodeForJoin, setRoomCodeForJoin] = useState(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [submittedWords, setSubmittedWords] = useState([]);
  const [drawings, setDrawings] = useState([]); // Добавляем состояние для сохранения рисунков
  
  const { user, login, register, logout, isAuthenticated } = useAuth();
  const [userStats, setUserStats] = useState({
    games: 0,
    wins: 0,
    points: 0,
  });

  useEffect(() => {
    if (
      showRegister ||
      showLogin ||
      showSettings ||
      showChooseGame ||
      showRoom ||
      showCreateWords ||
      showDrawing ||
      showGuessing
    ) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showRegister, showLogin, showSettings, showChooseGame, showRoom, showCreateWords, showDrawing, showGuessing]);

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
    setShowLogin(false);
    setShowRegister(true);
  };

  const switchToLogin = () => {
    setShowRegister(false);
    setShowLogin(true);
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    setUserStats({ games: 12, wins: 8, points: 450 });
  };

  const handleRegisterSuccess = () => {
    setShowRegister(false);
    setUserStats({ games: 0, wins: 0, points: 0 });
  };

  const handleBackFromChooseGame = () => {
    setShowChooseGame(false);
  };

  // Обработка присоединения по коду
  const handleJoinByCode = (code) => {
    setRoomCodeForJoin(code);
    setIsCreatingRoom(false);
    setShowChooseGame(false);
    setShowRoom(true);
  };

  // Обработка создания комнаты
  const handleRoomCreated = (roomId) => {
    console.log('🎉 Комната создана, переходим в RoomPage с ID:', roomId);
    setRoomCodeForJoin(roomId);
    setIsCreatingRoom(true);
    setShowChooseGame(false);
    setShowRoom(true);
  };

  // Обработка возврата из комнаты
  const handleBackFromRoom = () => {
    setShowRoom(false);
    setShowChooseGame(true);
  };

  // Обработка клика на "Создать комнату" в MainScreen
  const handleCreateRoomClick = () => {
    setShowChooseGame(true);
  };

  // Обработчик начала игры - переходит на страницу ввода слов
  const handleStartGame = (roomCode, players) => {
    console.log('🎮 Начинаем игру в комнате:', roomCode, 'Игроки:', players);
    setShowRoom(false);
    setShowCreateWords(true);
  };

  // Обработчик отправки слов - переходит на страницу рисования
  const handleSubmitWords = (words) => {
    console.log('📝 Слова отправлены:', words);
    setSubmittedWords(words);
    setShowCreateWords(false);
    setShowDrawing(true);
  };

  // Обработчик завершения рисования - переходит на страницу угадывания
  const handleDrawingComplete = (drawingData) => {
    console.log('🎨 Рисунок завершен:', drawingData);
    // Сохраняем рисунок (в реальном приложении здесь будет логика сохранения)
    setDrawings(prev => [...prev, {
      id: Date.now(),
      image: drawingData, // Здесь будет data URL рисунка
      artist: user?.login || 'Игрок',
      originalWord: submittedWords[0] || 'Слово'
    }]);
    setShowDrawing(false);
    setShowGuessing(true); // Переходим на страницу угадывания
  };

  // Обработчик возврата со страницы рисования
  const handleBackFromDrawing = () => {
    setShowDrawing(false);
    setShowRoom(true);
  };

  // Обработчик возврата со страницы угадывания
  const handleBackFromGuessing = () => {
    setShowGuessing(false);
    setShowRoom(true);
  };

  // Обработчик отправки догадки
  const handleSubmitGuess = (guess, drawingIndex) => {
    console.log('🔍 Догадка отправлена:', guess, 'для рисунка:', drawingIndex);
    // Здесь будет логика обработки догадки
    // После угадывания всех рисунков можно переходить к результатам или следующему раунду
  };

  // Закрыть все модальные окна и вернуться на главный экран
  const closeAllModals = () => {
    setShowRegister(false);
    setShowLogin(false);
    setShowSettings(false);
    setShowChooseGame(false);
    setShowRoom(false);
    setShowCreateWords(false);
    setShowDrawing(false);
    setShowGuessing(false);
  };

  return (
    <div className="App" style={{ minHeight: '100vh' }}>
      {/* Главный экран */}
      {!showChooseGame && !showRegister && !showLogin && !showSettings && !showRoom && !showCreateWords && !showDrawing && !showGuessing && (
        <MainScreen
          onLoginClick={() => setShowLogin(true)}
          onRegisterClick={() => setShowRegister(true)}
          onSettingsClick={() => setShowSettings(true)}
          onStartGameClick={() => setShowChooseGame(true)}
          onCreateRoomClick={handleCreateRoomClick}
          isAuthenticated={isAuthenticated}
          onLogoutClick={logout}
          userStats={userStats}
        />
      )}

      {/* Выбор режима игры */}
      {showChooseGame && (
        <ChooseGameMode
          onBack={handleBackFromChooseGame}
          onJoinByCode={handleJoinByCode}
          onRoomCreated={handleRoomCreated}
          availableRooms={[]}
          onStartGame={handleStartGame}
        />
      )}

      {/* Страница создания слов */}
      {showCreateWords && (
        <CreateWordsPage
          onBack={() => setShowCreateWords(false)}
          onSubmitWords={handleSubmitWords}
          players={[]}
          roomCode={roomCodeForJoin}
        />
      )}

      {/* Страница рисования */}
      {showDrawing && (
        <DrawingPage
          onBack={handleBackFromDrawing}
          onDrawingComplete={handleDrawingComplete} // Добавляем обработчик завершения рисования
          words={submittedWords}
          players={[]}
          roomCode={roomCodeForJoin}
        />
      )}

      {/* Страница угадывания */}
      {showGuessing && (
        <GuessingPage
          onBack={handleBackFromGuessing}
          onSubmitGuess={handleSubmitGuess}
          drawings={drawings}
          players={[]}
          roomCode={roomCodeForJoin}
        />
      )}

      {/* Страница комнаты */}
      {showRoom && (
        <RoomPage
          roomCode={roomCodeForJoin}
          isCreating={isCreatingRoom}
          onBack={handleBackFromRoom}
          onStartGame={handleStartGame}
        />
      )}

      {/* Окно регистрации */}
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

      {/* Окно входа */}
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

      {/* Окно настроек */}
      {showSettings && (
        <SettingsWindow onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

export default App;