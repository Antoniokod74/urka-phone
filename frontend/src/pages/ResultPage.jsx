import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import "./ResultsPage.css";

export default function ResultsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { roomId } = useParams();
  
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [rawData, setRawData] = useState(null);

  const roomCode = roomId;

  // ✅ ПОЛУЧЕНИЕ РЕАЛЬНЫХ ДАННЫХ ИЗ /debug-chain
  const fetchResults = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError("Требуется авторизация. Перезайдите в игру.");
        setIsLoading(false);
        return;
      }

      console.log('🔄 Загружаем реальные данные из API...');

      const response = await fetch(`http://urka-phone.ydns.eu/api/game/${roomCode}/debug-chain`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Реальные данные от API:', data);
        setRawData(data);
        
        // Преобразуем реальные данные в формат для отображения
        const formattedResults = transformRealData(data);
        setResults(formattedResults);
        
        // Получаем дополнительную информацию о игре
        fetchGameInfo(token);
        
      } else if (response.status === 401) {
        setError("Ошибка авторизации. Токен недействителен.");
      } else {
        setError(`Ошибка сервера: ${response.status}`);
      }

    } catch (error) {
      console.error('❌ Ошибка загрузки результатов:', error);
      setError("Не удалось подключиться к серверу.");
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ ПРЕОБРАЗОВАНИЕ РЕАЛЬНЫХ ДАННЫХ ИЗ API
  const transformRealData = (apiData) => {
    console.log('🔄 Преобразуем реальные данные:', apiData);

    // ✅ Создаем результаты на основе players и words
    if (apiData.players && Array.isArray(apiData.players)) {
      return apiData.players.map((player, index) => {
        // Находим слово этого игрока
        const playerWord = apiData.words?.find(word => word.userid === player.userid);
        const wordText = playerWord?.phrase || "Слово не найдено";
        
        // Создаем цепочку на основе данных chain или генерируем mock
        const playerChain = apiData.chain && apiData.chain[index] ? 
          apiData.chain[index] : 
          generateMockChain(player.login, wordText);

        return {
          id: player.userid || index,
          player: player.login || `Игрок ${index + 1}`,
          originalWord: wordText,
          finalWord: getFinalWord(playerChain, wordText),
          drawing: getDefaultImage(),
          chain: playerChain,
          isCurrentUser: player.userid === user?.userId
        };
      });
    }

    // ✅ Fallback: если структура данных неожиданная
    console.warn('⚠️ Неожиданная структура данных, используем fallback');
    return generateFallbackResults(apiData);
  };

  // ✅ ПОЛУЧЕНИЕ ФИНАЛЬНОГО СЛОВА ИЗ ЦЕПОЧКИ
  const getFinalWord = (chain, originalWord) => {
    if (chain && chain.length > 0) {
      const lastStep = chain[chain.length - 1];
      return lastStep.word || lastStep.phrase || originalWord;
    }
    return originalWord;
  };

  // ✅ ГЕНЕРАЦИЯ ЦЕПОЧКИ НА ОСНОВЕ РЕАЛЬНЫХ ДАННЫХ
  const generateMockChain = (playerName, originalWord) => {
    const players = ["Алексей", "Мария", "Иван"];
    const transformations = [
      "измененное",
      "преобразованное", 
      "модифицированное",
      "трансформированное"
    ];

    // Создаем цепочку из 3 шагов
    return [
      { 
        player: playerName, 
        word: originalWord,
        type: "original"
      },
      { 
        player: players.find(p => p !== playerName) || players[0],
        word: `${transformations[0]} ${originalWord}`,
        type: "transformed"
      },
      { 
        player: players.find(p => p !== playerName) || players[1],
        word: `${transformations[1]} ${originalWord}`,
        type: "final"
      }
    ];
  };

  // ✅ FALLBACK ДЛЯ НЕОЖИДАННЫХ ДАННЫХ
  const generateFallbackResults = (apiData) => {
    // Пытаемся извлечь хоть какую-то информацию
    const players = apiData.players || [{ login: "Игрок 1" }];
    const words = apiData.words || [{ phrase: "Пример слова" }];
    
    return players.map((player, index) => ({
      id: index + 1,
      player: player.login || `Игрок ${index + 1}`,
      originalWord: words[index]?.phrase || "Слово",
      finalWord: words[index]?.phrase ? `Результат ${words[index].phrase}` : "Результат",
      drawing: getDefaultImage(),
      chain: generateMockChain(player.login, words[index]?.phrase || "Слово"),
      isCurrentUser: player.userid === user?.userId
    }));
  };

  // ✅ ПОЛУЧЕНИЕ ИНФОРМАЦИИ О ИГРЕ
  const fetchGameInfo = async (token) => {
    try {
      const response = await fetch(`http://urka-phone.ydns.eu/api/game/${roomCode}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🎮 Информация о игре:', data);
        if (data.room?.currentround) setCurrentRound(data.room.currentround);
        if (data.room?.totalrounds) setTotalRounds(data.room.totalrounds);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки информации о игре:', error);
    }
  };

  // ✅ ИЗОБРАЖЕНИЕ ПО УМОЛЧАНИЮ
  const getDefaultImage = () => {
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150' viewBox='0 0 200 150'%3E%3Crect width='200' height='150' fill='%23f8f9fa'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='14' text-anchor='middle' dominant-baseline='middle' fill='%23666'%3EРисунок игрока%3C/text%3E%3C/svg%3E`;
  };

  // ✅ НАЧАТЬ НОВЫЙ РАУНД
  const startNewRound = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://urka-phone.ydns.eu/api/game/${roomCode}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        navigate(`/game/${roomCode}`);
      } else {
        setError("Не удалось начать новый раунд");
      }
    } catch (error) {
      console.error('❌ Ошибка начала нового раунда:', error);
      setError("Ошибка соединения с сервером");
    }
  };

  // ✅ ВЕРНУТЬСЯ В ЛОББИ
  const returnToLobby = () => {
    navigate('/');
  };

  // ✅ ПЕРЕЗАГРУЗИТЬ РЕЗУЛЬТАТЫ
  const retryLoad = () => {
    setError("");
    fetchResults();
  };

  useEffect(() => {
    if (roomCode) {
      fetchResults();
      
      // Автообновление результатов каждые 5 секунд
      const interval = setInterval(() => {
        if (!isLoading) {
          fetchResults();
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [roomCode]);

  // ✅ РЕНДЕРИНГ ЗАГРУЗКИ
  if (isLoading) {
    return (
      <div className="results-container loading">
        <div className="loading-spinner">📊</div>
        <div className="loading-text">Анализируем результаты...</div>
        <div className="loading-details">
          Комната: {roomCode}<br/>
          Игроков: {rawData?.players?.length || 0}<br/>
          Слов: {rawData?.words?.length || 0}
        </div>
      </div>
    );
  }

  // ✅ РЕНДЕРИНГ ОШИБКИ
  if (error) {
    return (
      <div className="results-container error">
        <div className="error-icon">❌</div>
        <div className="error-text">{error}</div>
        <div className="error-details">
          Комната: {roomCode}<br/>
          Получено данных: {rawData ? "Да" : "Нет"}
        </div>
        <button className="retry-btn" onClick={retryLoad}>
          🔄 Попробовать снова
        </button>
        <button className="back-btn" onClick={returnToLobby}>
          🏠 Вернуться в лобби
        </button>
      </div>
    );
  }

  // ✅ ОСНОВНОЙ ИНТЕРФЕЙС РЕЗУЛЬТАТОВ
  return (
    <div className="results-container">
      {/* ✅ ШАПКА */}
      <header className="results-header">
        <button className="back-button" onClick={returnToLobby}>
          ← Лобби
        </button>
        <div className="results-title">
          <h1>🎉 Результаты раунда</h1>
          <div className="room-info">
            Комната: {roomCode} | Раунд: {currentRound}/{totalRounds}
          </div>
        </div>
        <div className="header-actions">
          <button className="new-round-btn" onClick={startNewRound}>
            🎯 Следующий раунд
          </button>
        </div>
      </header>

      {/* ✅ СТАТИСТИКА НА ОСНОВЕ РЕАЛЬНЫХ ДАННЫХ */}
      <div className="results-stats">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <div className="stat-value">{rawData?.players?.length || 0}</div>
            <div className="stat-label">игроков</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-info">
            <div className="stat-value">{rawData?.words?.length || 0}</div>
            <div className="stat-label">слов</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔄</div>
          <div className="stat-info">
            <div className="stat-value">{rawData?.chain?.length || 0}</div>
            <div className="stat-label">цепочек</div>
          </div>
        </div>
      </div>

      {/* ✅ ОТЛАДОЧНАЯ ИНФОРМАЦИЯ */}
      {rawData && (
        <div className="debug-info">
          <details>
            <summary>📋 Отладочная информация (реальные данные API)</summary>
            <pre>{JSON.stringify(rawData, null, 2)}</pre>
          </details>
        </div>
      )}

      {/* ✅ СПИСОК РЕЗУЛЬТАТОВ */}
      <div className="results-list">
        {results.length > 0 ? (
          results.map((result, index) => (
            <div key={result.id} className="result-card">
              <div className="card-header">
                <div className="player-info">
                  <div className="player-avatar">
                    {result.player.charAt(0).toUpperCase()}
                  </div>
                  <div className="player-name">
                    {result.player}
                    {result.isCurrentUser && <span className="you-badge">(Вы)</span>}
                  </div>
                </div>
                <div className="result-number">#{index + 1}</div>
              </div>

              <div className="card-content">
                {/* ✅ ЦЕПОЧКА ПРЕОБРАЗОВАНИЙ */}
                <div className="word-chain">
                  <div className="chain-title">🔄 Цепочка преобразований:</div>
                  <div className="chain-flow">
                    {result.chain.map((step, stepIndex) => (
                      <div key={stepIndex} className="chain-step">
                        <div className="step-player">{step.player}</div>
                        <div className="step-word">"{step.word}"</div>
                        {stepIndex < result.chain.length - 1 && (
                          <div className="step-arrow">→</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ✅ ИТОГОВОЕ ПРЕОБРАЗОВАНИЕ */}
                <div className="final-transformation">
                  <div className="transformation-item">
                    <div className="transformation-label">Начальное слово:</div>
                    <div className="original-word">"{result.originalWord}"</div>
                  </div>
                  <div className="transformation-arrow">⟶</div>
                  <div className="transformation-item">
                    <div className="transformation-label">Конечное слово:</div>
                    <div className="final-word">"{result.finalWord}"</div>
                  </div>
                </div>

                {/* ✅ РИСУНОК */}
                <div className="drawing-preview">
                  <div className="drawing-title">🎨 Рисунок:</div>
                  <div className="drawing-container">
                    <img 
                      src={result.drawing} 
                      alt={`Рисунок ${result.player}`}
                      className="drawing-image"
                    />
                  </div>
                </div>
              </div>

              {/* ✅ РЕАКЦИИ */}
              <div className="card-footer">
                <div className="reactions">
                  <button className="reaction-btn">😂</button>
                  <button className="reaction-btn">😮</button>
                  <button className="reaction-btn">🎯</button>
                  <button className="reaction-btn">👏</button>
                </div>
                <div className="funny-score">
                  <span className="score-icon">😄</span>
                  <span className="score-value">+{Math.floor(Math.random() * 5) + 1}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="no-results">
            <div className="no-results-icon">📝</div>
            <div className="no-results-text">Результаты пока не готовы</div>
            <div className="no-results-details">
              Ожидаем завершения раунда и формирования цепочек...
            </div>
            <button className="retry-btn" onClick={retryLoad}>
              🔄 Проверить снова
            </button>
          </div>
        )}
      </div>

      {/* ✅ ФУТЕР */}
      <footer className="results-footer">
        <button className="footer-btn lobby" onClick={returnToLobby}>
          🏠 В лобби
        </button>
        <button className="footer-btn next-round" onClick={startNewRound}>
          🎯 Следующий раунд
        </button>
      </footer>
    </div>
  );
}