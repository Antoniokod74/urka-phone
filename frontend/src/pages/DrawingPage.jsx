import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./DrawingPage.css";
import { useAuth } from '../context/AuthContext';

export default function DrawingPage({ words = [], players = [], roomCode, onDrawingComplete }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canvasRef = useRef(null);
  const [currentWord, setCurrentWord] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [timeLeft, setTimeLeft] = useState(60);
  const [showWord, setShowWord] = useState(true);
  const [currentRound] = useState(1);
  const [totalRounds] = useState(3);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);

  const colors = [
    "#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00",
    "#FF00FF", "#00FFFF", "#FFA500", "#800080", "#FFC0CB",
    "#A52A2A", "#808080", "#FFFFFF"
  ];

  const brushSizes = [2, 5, 10, 15, 20];

  const handleTimeUp = useCallback(() => {
    const canvas = canvasRef.current;
    const drawingData = canvas.toDataURL();
    
    console.log('🎨 Рисунок завершен, переходим к угадыванию');
    
    if (onDrawingComplete) {
      onDrawingComplete(drawingData);
    }
  }, [onDrawingComplete]);

  useEffect(() => {
    if (words.length > 0) {
      if (players.length === 1 || currentRound === 1) {
        setCurrentWord(words[0]);
      } else {
        const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
        setCurrentPlayerIndex(nextPlayerIndex);
        setCurrentWord(words[nextPlayerIndex] || words[0]);
      }
    }
  }, [words, players, currentRound, currentPlayerIndex]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      handleTimeUp();
    }
  }, [timeLeft, handleTimeUp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = 800;
    canvas.height = 500;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }, []);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    
    ctx.beginPath();
    ctx.moveTo(
      e.clientX - rect.left,
      e.clientY - rect.top
    );
    
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    ctx.lineTo(
      e.clientX - rect.left,
      e.clientY - rect.top
    );
    ctx.stroke();
  };

  const stopDrawing = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.closePath();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleCompleteDrawing = () => {
    handleTimeUp();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const toggleWordVisibility = () => {
    setShowWord(!showWord);
  };

  return (
    <div className="drawing-container">
      <header className="drawing-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Назад
        </button>
        <div className="drawing-title">
          <h1>🎨 Время рисовать!</h1>
          <div className="room-info">Комната: {roomCode} | Раунд: {currentRound}/{totalRounds}</div>
        </div>
        <div className="timer-section">
          <div className={`timer ${timeLeft <= 10 ? 'urgent' : ''}`}>
            ⏰ {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      <div className="drawing-content">
        <div className="tools-panel">
          <h3>🛠️ Инструменты</h3>
          
          <div className="color-palette">
            <h4>Цвета:</h4>
            <div className="colors-grid">
              {colors.map((colorItem, index) => (
                <button
                  key={index}
                  className={`color-btn ${color === colorItem ? 'active' : ''}`}
                  style={{ backgroundColor: colorItem }}
                  onClick={() => setColor(colorItem)}
                />
              ))}
            </div>
          </div>

          <div className="brush-sizes">
            <h4>Размер кисти:</h4>
            <div className="sizes-grid">
              {brushSizes.map((size, index) => (
                <button
                  key={index}
                  className={`size-btn ${brushSize === size ? 'active' : ''}`}
                  onClick={() => setBrushSize(size)}
                >
                  <div 
                    className="brush-preview"
                    style={{ 
                      width: size, 
                      height: size,
                      backgroundColor: color 
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="actions">
            <button className="action-btn clear" onClick={clearCanvas}>
              🗑️ Очистить
            </button>
            <button className="action-btn undo">
              ↩️ Отменить
            </button>
            <button 
              className={`action-btn ${showWord ? 'hide' : 'show'}`}
              onClick={toggleWordVisibility}
            >
              {showWord ? '👁️‍🗨️ Скрыть слово' : '👁️‍🗨️ Показать слово'}
            </button>
            <button 
              className="action-btn complete"
              onClick={handleCompleteDrawing}
            >
              ✅ Завершить
            </button>
          </div>

          <div className="brush-preview-section">
            <h4>Предпросмотр:</h4>
            <div className="preview-canvas">
              <div 
                className="preview-dot"
                style={{ 
                  width: brushSize * 2, 
                  height: brushSize * 2,
                  backgroundColor: color,
                  border: brushSize < 5 ? '1px solid #ccc' : 'none'
                }}
              />
            </div>
          </div>
        </div>

        <div className="drawing-area">
          <div className={`word-display ${showWord ? 'visible' : 'hidden'}`}>
            <div className="word-label">Рисуйте:</div>
            <div className="the-word">{currentWord}</div>
            <div className="word-hint">(Это слово придумал другой игрок)</div>
          </div>

          <div className="canvas-container">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="drawing-canvas"
            />
          </div>

          <div className="drawing-tips">
            <h4>💡 Советы для рисования:</h4>
            <div className="tips-list">
              <span>🎯 Делайте рисунок понятным</span>
              <span>✏️ Используйте разные цвета</span>
              <span>⏱️ Следите за временем</span>
              <span>⏰ Осталось: {formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>

        <div className="info-panel">
          <h3>📊 Информация</h3>
          
          <div className="current-artist">
            <h4>🎨 Сейчас рисует:</h4>
            <div className="artist-info">
              <div className="artist-avatar">
                {user?.login?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="artist-name">
                {user?.login || 'Вы'}
                <span className="you-badge">(Вы)</span>
              </div>
            </div>
          </div>

          <div className="game-progress">
            <h4>📈 Прогресс раунда:</h4>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${((60 - timeLeft) / 60) * 100}%` }}
              />
            </div>
            <div className="progress-text">
              {60 - timeLeft} из 60 секунд
            </div>
          </div>

          <div className="next-artist">
            <h4>⏭️ Следующий художник:</h4>
            <div className="next-player">
              {players.length > 1 ? (
                <>
                  <div className="next-avatar">
                    {players[(currentPlayerIndex + 1) % players.length]?.login?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="next-name">
                    {players[(currentPlayerIndex + 1) % players.length]?.login || 'Игрок'}
                  </div>
                </>
              ) : (
                <div className="solo-mode">🎮 Режим соло</div>
              )}
            </div>
          </div>

          <div className="quick-tools">
            <h4>⚡ Быстрые инструменты:</h4>
            <div className="quick-buttons">
              <button 
                className="quick-btn black"
                onClick={() => setColor("#000000")}
                title="Черный"
              />
              <button 
                className="quick-btn red"
                onClick={() => setColor("#FF0000")}
                title="Красный"
              />
              <button 
                className="quick-btn blue" 
                onClick={() => setColor("#0000FF")}
                title="Синий"
              />
              <button 
                className="quick-btn small"
                onClick={() => setBrushSize(2)}
                title="Тонкая кисть"
              >
                •
              </button>
              <button 
                className="quick-btn large"
                onClick={() => setBrushSize(10)}
                title="Толстая кисть"
              >
                ●
              </button>
            </div>
          </div>

          <div className="quick-complete">
            <button 
              className="complete-now-btn"
              onClick={handleCompleteDrawing}
            >
              🏁 Завершить сейчас
            </button>
          </div>
        </div>
      </div>

      <div className="mobile-tools">
        <div className="mobile-colors">
          {colors.slice(0, 6).map((colorItem, index) => (
            <button
              key={index}
              className={`mobile-color-btn ${color === colorItem ? 'active' : ''}`}
              style={{ backgroundColor: colorItem }}
              onClick={() => setColor(colorItem)}
            />
          ))}
        </div>
        <div className="mobile-actions">
          <button className="mobile-action-btn" onClick={clearCanvas}>
            🗑️
          </button>
          <button className="mobile-action-btn" onClick={toggleWordVisibility}>
            {showWord ? '👁️‍🗨️' : '👁️'}
          </button>
          <button className="mobile-action-btn complete" onClick={handleCompleteDrawing}>
            ✅
          </button>
        </div>
      </div>
    </div>
  );
}