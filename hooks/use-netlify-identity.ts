"use client";

import { useCallback, useEffect, useState } from "react";

export type IdentityEventHandler = (user?: NetlifyIdentityUser | null) => void;

export interface NetlifyIdentityUser {
  app_metadata?: {
    roles?: string[];
  };
}

export interface NetlifyIdentity {
  on?: (event: string, callback: IdentityEventHandler) => void;
  off?: (event: string, callback: IdentityEventHandler) => void;
  open?: (modal?: string) => void;
  init?: () => void;
  currentUser?: () => NetlifyIdentityUser | null;
  logout?: () => void;
}

const getIdentity = () =>
  typeof window === "undefined"
    ? undefined
    : (window as Window & { netlifyIdentity?: NetlifyIdentity }).netlifyIdentity;

export const useNetlifyIdentity = () => {
  const [currentUser, setCurrentUser] = useState<NetlifyIdentityUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const updateUserState = useCallback((user?: NetlifyIdentityUser | null) => {
    const nextUser = user ?? null;
    setCurrentUser(nextUser);

    const roles =
      nextUser && Array.isArray(nextUser.app_metadata?.roles)
        ? (nextUser.app_metadata?.roles as string[])
        : [];
    setIsAdmin(nextUser !== null && roles.includes("admin"));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let cleanup: (() => void) | undefined;
    let interval: number | undefined;
    let initialized = false;

    const setupIdentity = () => {
      if (initialized) return true;

      const identity = getIdentity();
      if (!identity || typeof identity.on !== "function") {
        return false;
      }

      initialized = true;
      const handleInit: IdentityEventHandler = (user) => updateUserState(user ?? null);
      const handleLogin: IdentityEventHandler = (user) => updateUserState(user ?? null);
      const handleLogout = () => updateUserState(null);
      const handleUserEvent: IdentityEventHandler = (user) => updateUserState(user ?? null);

      identity.on?.("init", handleInit);
      identity.on?.("login", handleLogin);
      identity.on?.("logout", handleLogout);
      identity.on?.("user", handleUserEvent);

      identity.init?.();

      const existingUser = identity.currentUser?.();
      if (existingUser) {
        updateUserState(existingUser);
      }

      cleanup = () => {
        identity.off?.("init", handleInit);
        identity.off?.("login", handleLogin);
        identity.off?.("logout", handleLogout);
        identity.off?.("user", handleUserEvent);
      };

      return true;
    };

    if (!setupIdentity()) {
      interval = window.setInterval(() => {
        if (setupIdentity()) {
          if (interval !== undefined) {
            window.clearInterval(interval);
          }
        }
      }, 500);
    }

    return () => {
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
      cleanup?.();
    };
  }, [updateUserState]);

  const openLogin = useCallback(() => {
    const identity = getIdentity();
    identity?.open?.("login");
  }, []);

  const logout = useCallback(() => {
    const identity = getIdentity();
    identity?.logout?.();
    updateUserState(null);
  }, [updateUserState]);

  return {
    currentUser,
    isLoggedIn: currentUser !== null,
    isAdmin,
    openLogin,
    logout,
  };
};
