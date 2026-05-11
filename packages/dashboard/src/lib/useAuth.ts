import { useEffect, useState } from "react";

const STORAGE_KEY = "sysko.auth";

export interface UseAuthResult {
  passwordRequired: boolean;
  password: string | null;
  loading: boolean;
  error: string | null;
  login: (pw: string) => Promise<boolean>;
  logout: () => void;
}

export function useAuth(): UseAuthResult {
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/_sysko/meta")
      .then((r) => r.json() as Promise<{ passwordRequired: boolean }>)
      .then((meta) => {
        setPasswordRequired(meta.passwordRequired);
        if (meta.passwordRequired) {
          const saved = sessionStorage.getItem(STORAGE_KEY);
          if (saved) setPassword(saved);
        }
      })
      .catch(() => {
        // Meta fetch failed — assume no auth required and let WS handle it.
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (pw: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await fetch("/_sysko/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        sessionStorage.setItem(STORAGE_KEY, pw);
        setPassword(pw);
        return true;
      }
      setError("Wrong password.");
      return false;
    } catch {
      setError("Could not reach the dashboard server.");
      return false;
    }
  };

  const logout = (): void => {
    sessionStorage.removeItem(STORAGE_KEY);
    setPassword(null);
  };

  return { passwordRequired, password, loading, error, login, logout };
}
