export interface UserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  whatsapp: string;
  phone?: string;
  address?: string;
}

const USERS_KEY = 'app_users_db';
const CURRENT_USER_KEY = 'app_current_user';

export const authService = {
  getUsers(): UserAccount[] {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveUsers(users: UserAccount[]) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  getCurrentUser(): UserAccount | null {
    const data = localStorage.getItem(CURRENT_USER_KEY);
    return data ? JSON.parse(data) : null;
  },

  setCurrentUser(user: UserAccount | null) {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  },

  hashPassword(password: string): string {
    return btoa(password); // 简单前端 Mock 哈希
  },

  login(email: string, pass: string): UserAccount {
    const users = this.getUsers();
    const hash = this.hashPassword(pass);
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === hash);
    if (!user) {
      throw new Error('Invalid email or password');
    }
    this.setCurrentUser(user);
    return user;
  },

  register(name: string, email: string, pass: string, phone: string): UserAccount {
    const users = this.getUsers();
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new Error('Email already registered');
    }
    const newUser: UserAccount = {
      id: `usr_${Date.now()}`,
      name,
      email,
      passwordHash: this.hashPassword(pass),
      whatsapp: phone || '601158892234',
      phone,
      address: '',
    };
    users.push(newUser);
    this.saveUsers(users);
    this.setCurrentUser(newUser);
    return newUser;
  },

  logout() {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
};
