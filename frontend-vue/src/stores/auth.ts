import { defineStore } from "pinia";
import type { AuthUser } from "@/api/auth";
import { clearAuth, getMe, getStoredUser, login as apiLogin } from "@/api/auth";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null as AuthUser | null,
    ready: false,
  }),
  getters: {
    role(state) {
      return state.user?.role || null;
    },
    isAuthed(state) {
      return !!state.user;
    },
  },
  actions: {
    initFromStorage() {
      this.user = getStoredUser();
      this.ready = true;
    },
    async ensureMe() {
      if (this.user) return this.user;
      try {
        const me = await getMe();
        this.user = me;
        return me;
      } catch {
        return null;
      } finally {
        this.ready = true;
      }
    },
    async login(username: string, password: string) {
      const user = await apiLogin(username, password);
      this.user = user;
      return user;
    },
    logout() {
      clearAuth();
      this.user = null;
    },
  },
});

