import React, { useState } from 'react';
import './SettingsWindow.css';
import { useAuth } from '../context/AuthContext';

export default function SettingsWindow({ onClose }) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [effectsVolume, setEffectsVolume] = useState(80);
  const [musicVolume, setMusicVolume] = useState(70);
  
  const { isAuthenticated, logout } = useAuth();

  const handleSoundToggle = () => {
    setSoundEnabled(!soundEnabled);
  };

  const handleMusicToggle = () => {
    setMusicEnabled(!musicEnabled);
  };

  const handleEffectsVolumeChange = (e) => {
    setEffectsVolume(parseInt(e.target.value));
  };

  const handleMusicVolumeChange = (e) => {
    setMusicVolume(parseInt(e.target.value));
  };

  const handleLogout = () => {
    logout();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Настройки</h2>
        
        {/* Настройки звука */}
        <div className="settings-section">
          <h3>Звук</h3>
          
          <div className="setting-item">
            <div className="setting-label">
              <span>Звуковые эффекты</span>
              <span className="setting-status">
                {soundEnabled ? 'Вкл' : 'Выкл'}
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={handleSoundToggle}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-label">
              <span>Громкость эффектов</span>
              <span className="setting-value">{effectsVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={effectsVolume}
              onChange={handleEffectsVolumeChange}
              disabled={!soundEnabled}
              className="volume-slider"
            />
          </div>

          <div className="setting-divider"></div>

          <div className="setting-item">
            <div className="setting-label">
              <span>Фоновая музыка</span>
              <span className="setting-status">
                {musicEnabled ? 'Вкл' : 'Выкл'}
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={musicEnabled}
                onChange={handleMusicToggle}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-label">
              <span>Громкость музыки</span>
              <span className="setting-value">{musicVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={musicVolume}
              onChange={handleMusicVolumeChange}
              disabled={!musicEnabled}
              className="volume-slider"
            />
          </div>
        </div>

        {/* Кнопка выхода из аккаунта */}
        {isAuthenticated && (
          <div className="settings-section">
            <h3>Аккаунт</h3>
            <button 
              className="logout-button" 
              onClick={handleLogout}
            >
              Выйти из аккаунта
            </button>
          </div>
        )}

        <button className="close-button" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}