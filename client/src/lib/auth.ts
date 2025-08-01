import { apiRequest } from "./queryClient";

export interface AuthUser {
  id: string;
  username: string;
  role: "waiter" | "cashier" | "manager";
  assignedTables?: number[] | null;
  name?: string | null;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await apiRequest("POST", "/api/login", { username, password });
    const data = await response.json();
    
    // Store token in localStorage
    localStorage.setItem("auth_token", data.token);
    
    return data;
  },

  async register(username: string, password: string, role: string): Promise<void> {
    await apiRequest("POST", "/api/register", { username, password, role });
  },

  logout(): void {
    localStorage.removeItem("auth_token");
  },

  getToken(): string | null {
    return localStorage.getItem("auth_token");
  },

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp > Date.now() / 1000;
    } catch {
      return false;
    }
  },

  getUserFromToken(): AuthUser | null {
    const token = this.getToken();
    if (!token) return null;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        id: payload.id,
        username: payload.username || '',
        role: payload.role,
        assignedTables: payload.assignedTables,
        name: payload.name || null
      };
    } catch {
      return null;
    }
  }
};
