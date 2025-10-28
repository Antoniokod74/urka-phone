import React, { useState } from "react";
import "./LoginWindow.css";
import myImage from "../assets/imagregavt.png";

export default function LoginWindow({ onSwitchToRegister, onLoginSuccess, onHomeClick, onLogin }) {
  const [formData, setFormData] = useState({
    username: "",
    password: ""
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Очищаем ошибку при изменении поля
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = "Имя пользователя обязательно";
    }

    if (!formData.password) {
      newErrors.password = "Пароль обязателен";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      // Используем переданную функцию входа из AuthContext
      await onLogin({
        login: formData.username,
        password: formData.password
      });
      
      // После успешного входа вызываем колбэк
      onLoginSuccess();
      
      // Сброс формы
      setFormData({
        username: "",
        password: ""
      });
      
    } catch (error) {
      // Обработка ошибок сервера
      setErrors({ submit: error.message || "Неверное имя пользователя или пароль" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Кнопка домой в левом верхнем углу */}
      <button 
        className="home-button"
        onClick={onHomeClick}
        disabled={isLoading}
        title="Вернуться на главную"
      >
        ← Домой
      </button>

      <div className="login-info">
        <h1>Urka Phone</h1>
        <p>Рисуйте, угадывайте и веселитесь с друзьями в многопользовательской игре!</p>
        <img src={myImage} alt="Описание" className="login-image" />
        <div className="features">
          <div className="feature">
            <span>🎮</span>
            <div>
              <h3>Веселые игры</h3>
              <p>Рисуй и угадывай</p>
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

      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Войти в игру</h2>
        <p>Введите свои данные для входа</p>
        
        <label>Имя пользователя</label>
        <input 
          type="text" 
          name="username"
          placeholder="Введите имя пользователя" 
          value={formData.username}
          onChange={handleInputChange}
          className={errors.username ? "error" : ""}
          disabled={isLoading}
        />
        {errors.username && <span className="error-text">{errors.username}</span>}
        
        <label>Пароль</label>
        <input 
          type="password" 
          name="password"
          placeholder="Введите пароль" 
          value={formData.password}
          onChange={handleInputChange}
          className={errors.password ? "error" : ""}
          disabled={isLoading}
        />
        {errors.password && <span className="error-text">{errors.password}</span>}
        
        {errors.submit && <span className="error-text submit-error">{errors.submit}</span>}
        
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Вход..." : "Войти"}
        </button>
        
        <p className="register-hint">
          Нет аккаунта?{' '}
          <span 
            className="register-link" 
            onClick={isLoading ? undefined : onSwitchToRegister}
            style={{ cursor: isLoading ? 'not-allowed' : 'pointer' }}
          >
            Зарегистрируйтесь
          </span>
        </p>
      </form>
    </div>
  );
}