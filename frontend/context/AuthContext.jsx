import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentUser } from "../services/authService.js";

const AuthContext = createContext(null);

function getStoredUser() {
  try {
    const storedUser = localStorage.getItem("ehr_user");
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    localStorage.removeItem("ehr_user");
    localStorage.removeItem("ehr_token");
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("ehr_token")));

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const token = localStorage.getItem("ehr_token");

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { user: currentUser } = await getCurrentUser();

        if (active) {
          localStorage.setItem("ehr_user", JSON.stringify(currentUser));
          setUser(currentUser);
        }
      } catch {
        localStorage.removeItem("ehr_user");
        localStorage.removeItem("ehr_token");

        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  const saveSession = (payload) => {
    localStorage.setItem("ehr_user", JSON.stringify(payload.user));
    if (payload.token) {
      localStorage.setItem("ehr_token", payload.token);
    }
    setUser(payload.user);
  };

  const logout = () => {
    localStorage.removeItem("ehr_user");
    localStorage.removeItem("ehr_token");
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      saveSession,
      logout
    }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
