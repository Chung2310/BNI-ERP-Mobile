import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { authService } from "@/services/auth";
import type { UserProfile } from "@/types";

type AuthState = {
  isLoading: boolean;
  token: string | null;
  user: UserProfile | null;
  signIn(identifier: string, password: string): Promise<void>;
  signInWithBiometrics(): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(password: string): Promise<void>;
  refreshProfile(): Promise<UserProfile>;
  applyProfile(profile: UserProfile): void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    authService.restore()
      .then((session) => {
        setToken(session?.token || null);
        setUser(session?.user || null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const session = await authService.login(identifier, password);
    setToken(session.token);
    setUser(session.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setToken(null);
      setUser(null);
    }
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    await authService.deleteOwnAccount(password);
    setToken(null);
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const profile = await authService.getProfile();
    setUser(profile);
    return profile;
  }, []);

  const applyProfile = useCallback((profile: UserProfile) => setUser(profile), []);

  const signInWithBiometrics = useCallback(async () => {
    const session = await authService.loginWithBiometrics();
    setToken(session.token);
    setUser(session.user);
  }, []);

  const value = useMemo(
    () => ({ isLoading, token, user, signIn, signInWithBiometrics, signOut, deleteAccount, refreshProfile, applyProfile }),
    [isLoading, token, user, signIn, signInWithBiometrics, signOut, deleteAccount, refreshProfile, applyProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
