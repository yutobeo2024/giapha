import React, { createContext, useContext } from "react";
import { useAuth, type AuthState } from "./useAuth";

const AuthContext = createContext<AuthState | null>(null);

/** Bọc một lần ở App để Layout và các trang dùng chung một listener auth. */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const state = useAuth();
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
};

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext phải dùng bên trong <AuthProvider>");
  return ctx;
}
