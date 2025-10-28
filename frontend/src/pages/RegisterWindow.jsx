import React, { useState } from "react";
import "./RegisterWindow.css";
import myImage from '../assets/imagregavt.png';

export default function RegisterWindow({ onSwitchToLogin, onRegisterSuccess, onHomeClick, onRegister }) {
  const [formData, setFormData] = useState({
    login: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Валидация
    if (!formData.login || !formData.password) {
      setError('Все поля обязательны для заполнения');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      setLoading(false);
      return;
    }

    try {
      if (onRegister) {
        await onRegister({
          login: formData.login,
          password: formData.password
        });
      }

      onRegisterSuccess();

      // Можно сбросить форму после успешной регистрации
      setFormData({
        login: '',
        password: '',
        confirmPassword: ''
      });
    } catch (error) {
      setError(error.message || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <button 
        className="home-button"
        onClick={onHomeClick}
        disabled={loading}
        title="Вернуться на главную"
      >
        ← Домой
      </button>

      <div className="register-info">
        <h1>Urka Phone</h1>
        <p>Рисуйте, угадывайте и веселитесь с друзьями в многопользовательской игре!</p>
        <img src={myImage} alt="Иллюстрация регистрации" className="register-image" />
        <div className="features">
          <div className="feature">
            <span>🎮</span>
            <div>
              <h3>Веселые игры</h3>
              <p>Рисуй и угадай</p>
            </div>
          </div>
          <div className="feature">
            <span>👥</span>
            <div>
              <h3>С друзьями</h3>
              <p>До 8 игроков</p>
            </div>
          </div>
        </div>
      </div>

      <form className="register-form" onSubmit={handleSubmit}>
        <h2>Создать аккаунт</h2>
        <p>Зарегистрируйтесь, чтобы начать играть</p>

        <input
          type="text"
          name="login"
          placeholder="Введите имя пользователя"
          value={formData.login}
          onChange={handleChange}
          className={error && (!formData.login || formData.login.length < 3) ? "error" : ""}
          disabled={loading}
        />
        {error && !formData.login && <span className="error-text">Имя пользователя обязательно</span>}

        <input
          type="password"
          name="password"
          placeholder="Введите пароль"
          value={formData.password}
          onChange={handleChange}
          className={error && (formData.password.length < 6) ? "error" : ""}
          disabled={loading}
        />
        {error && formData.password.length < 6 && <span className="error-text">Пароль должен быть не менее 6 символов</span>}

        <input
          type="password"
          name="confirmPassword"
          placeholder="Подтвердите пароль"
          value={formData.confirmPassword}
          onChange={handleChange}
          className={error && (formData.password !== formData.confirmPassword) ? "error" : ""}
          disabled={loading}
        />
        {error && formData.password !== formData.confirmPassword && <span className="error-text">Пароли не совпадают</span>}

        {error && <span className="error-text submit-error">{error}</span>}

        <button type="submit" disabled={loading}>
          {loading ? "Регистрация..." : "Зарегистрироваться"}
        </button>

        <p className="login-hint">
          Уже есть аккаунт?{' '}
          <span 
            className="login-link" 
            onClick={loading ? undefined : onSwitchToLogin}
          >
            Войдите
          </span>
        </p>
      </form>
    </div>
  );
}
