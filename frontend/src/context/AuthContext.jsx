import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  const saveUserLocally = useCallback((userData) => {
    setUser(userData);

    if (userData) {
      localStorage.setItem(
        'creator_user',
        JSON.stringify(userData)
      );
    } else {
      localStorage.removeItem('creator_user');
    }
  }, []);

  const refreshUser = useCallback(
    async (authToken = null) => {
      const activeToken =
        authToken || token || localStorage.getItem('creator_token');

      if (!activeToken) {
        setUser(null);
        return null;
      }

      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch profile (${response.status})`
          );
        }

        const userData = await response.json();

        saveUserLocally(userData);

        return userData;
      } catch (error) {
        console.error('Failed to refresh user profile:', error);

        return null;
      }
    },
    [BACKEND_URL, token, saveUserLocally]
  );

  // Restore authentication state when the app starts.
  // The saved user is used immediately, then /me refreshes it
  // from the backend so pages receive the latest profile data.
  useEffect(() => {
    const initializeAuth = async () => {
      const savedToken = localStorage.getItem('creator_token');
      const savedUser = localStorage.getItem('creator_user');

      if (!savedToken) {
        setIsLoadingUser(false);
        return;
      }

      setToken(savedToken);

      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (error) {
          console.error(
            'Failed to parse saved user data:',
            error
          );

          localStorage.removeItem('creator_user');
        }
      }

      await refreshUser(savedToken);

      setIsLoadingUser(false);
    };

    initializeAuth();
  }, [refreshUser]);

  const login = async (newToken, userData = null) => {
    setToken(newToken);

    localStorage.setItem('creator_token', newToken);

    if (userData) {
      saveUserLocally(userData);
    }

    // Always fetch the current profile after login so the
    // context contains the authoritative backend data.
    await refreshUser(newToken);
  };

  const updateUser = (userData) => {
    saveUserLocally(userData);
  };

  const logout = () => {
    setToken(null);
    setUser(null);

    localStorage.removeItem('creator_token');
    localStorage.removeItem('creator_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        refreshUser,
        updateUser,
        isLoadingUser,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};