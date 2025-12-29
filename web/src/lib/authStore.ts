import { create } from "zustand";
import { wsStore } from "./wsStore";

const TOKEN_KEY = "auth_token";

interface AuthState {
	token: string | null;
}

export const useAuthStore = create<AuthState>(() => ({
	token: localStorage.getItem(TOKEN_KEY),
}));

export const selectIsAuthenticated = (state: AuthState) => !!state.token;

export const authActions = {
	login: (token: string) => {
		localStorage.setItem(TOKEN_KEY, token);
		useAuthStore.setState({ token });
	},
	logout: () => {
		wsStore.disconnect();
		localStorage.removeItem(TOKEN_KEY);
		useAuthStore.setState({ token: null });
	},
	getToken: () => useAuthStore.getState().token ?? "",
};
