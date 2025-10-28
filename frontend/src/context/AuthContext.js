import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Функция для проверки валидности токена
  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return null;
      }

      const response = await fetch('http://localhost:5000/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data.user;
      } else {
        // Токен невалидный, очищаем хранилище
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        return null;
      }
    } catch (error) {
      console.error('❌ Auth check error:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      
      if (token && userData) {
        try {
          // Проверяем валидность токена на сервере
          await checkAuth();
        } catch (error) {
          console.error('Error initializing auth:', error);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const register = async (userData) => {
    try {
      console.log('🔄 Registering user:', { ...userData, password: '***' });
      
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      
      console.log('✅ Registration successful:', data);
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      
      return data;
    } catch (error) {
      console.error('❌ Registration error:', error);
      throw error;
    }
  };

  const login = async (userData) => {
    try {
      console.log('🔄 Logging in user:', { ...userData, password: '***' });
      
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      
      return data;
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  // Функция для обновления статистики пользователя
  const updateUserStats = async (stats) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');
      
      const response = await fetch('http://localhost:5000/api/auth/stats', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(stats),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update stats');
      }
      
      // Обновляем пользователя в состоянии
      setUser(prevUser => ({
        ...prevUser,
        ...data.user
      }));
      
      // Обновляем в localStorage
      localStorage.setItem('user', JSON.stringify({
        ...user,
        ...data.user
      }));
      
      return data;
    } catch (error) {
      console.error('❌ Update stats error:', error);
      throw error;
    }
  };

  // Функция для принудительной проверки аутентификации
  const refreshUser = async () => {
    return await checkAuth();
  };

  // Функция для увеличения статистики (удобная обертка)
  const incrementStats = async (gameWon = false, pointsEarned = 0) => {
    const updates = {
      gamesplayed: (user?.gamesplayed || 0) + 1,
      gameswon: gameWon ? (user?.gameswon || 0) + 1 : (user?.gameswon || 0),
      points: (user?.points || 0) + pointsEarned
    };

    return await updateUserStats(updates);
  };

  // Функция для сброса статистики
  const resetStats = async () => {
    return await updateUserStats({
      gamesplayed: 0,
      gameswon: 0,
      points: 0
    });
  };

  const value = {
    user,
    register,
    login,
    logout,
    updateUserStats,
    incrementStats,
    resetStats,
    refreshUser,
    loading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};