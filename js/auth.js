/**
 * AuthManager - Handles authentication, session state, and admin user administration.
 */
class AuthManager {
  constructor() {
    this.currentUser = StorageService.getCurrentUser();
    this.listeners = [];
  }

  /**
   * Subscribe to auth changes (login, logout, switch user).
   */
  subscribe(callback) {
    this.listeners.push(callback);
  }

  notify() {
    this.listeners.forEach(fn => fn(this.currentUser));
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAdmin() {
    return this.currentUser && this.currentUser.role === 'admin';
  }

  /**
   * Logs in a user by username and password, authenticating against Spring Boot or local storage.
   */
  async login(username, password) {
    const cleanUser = username.trim().toLowerCase();

    // 1. Attempt Spring Boot REST API authentication
    try {
      const isAvailable = await ApiService.checkBackend();
      if (isAvailable) {
        const user = await ApiService.login(cleanUser, password);
        this.currentUser = user;
        StorageService.setCurrentUser(user);
        this.notify();
        return user;
      }
    } catch (backendErr) {
      if (ApiService.isBackendAvailable) {
        throw backendErr;
      }
    }

    // 2. Standalone fallback verification
    const users = StorageService.getUsers();
    const user = users.find(u => u.username.toLowerCase() === cleanUser && u.password === password);

    if (!user) {
      throw new Error('Invalid username or password.');
    }

    this.currentUser = user;
    StorageService.setCurrentUser(user);
    this.notify();
    return user;
  }

  /**
   * Registers a new regular user.
   */
  async register({ username, password, name }) {
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser || cleanUser.length < 3) {
      throw new Error('Username must be at least 3 characters.');
    }
    if (!password || password.length < 4) {
      throw new Error('Password must be at least 4 characters.');
    }

    // 1. Attempt Spring Boot registration
    try {
      const isAvailable = await ApiService.checkBackend();
      if (isAvailable) {
        const newUser = await ApiService.register(name, cleanUser, password);
        this.currentUser = newUser;
        StorageService.setCurrentUser(newUser);
        this.notify();
        return newUser;
      }
    } catch (backendErr) {
      if (ApiService.isBackendAvailable) {
        throw backendErr;
      }
    }

    // 2. Local fallback registration
    const users = StorageService.getUsers();
    if (users.some(u => u.username.toLowerCase() === cleanUser)) {
      throw new Error('Username is already taken.');
    }

    const newUser = {
      id: String(Date.now()),
      username: cleanUser,
      password,
      name: name.trim() || cleanUser,
      role: 'user',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    StorageService.saveUsers(users);

    this.currentUser = newUser;
    StorageService.setCurrentUser(newUser);
    this.notify();
    return newUser;
  }

  /**
   * Logs out the current user.
   */
  logout() {
    this.currentUser = null;
    StorageService.setCurrentUser(null);
    this.notify();
  }

  /**
   * Admin: List all users in system.
   */
  getAllUsers() {
    if (!this.isAdmin()) {
      throw new Error('Unauthorized: Admin access required.');
    }
    return StorageService.getUsers();
  }

  /**
   * Admin: Create a new user with chosen role (user or admin).
   */
  adminCreateUser({ username, password, name, role = 'user' }) {
    if (!this.isAdmin()) {
      throw new Error('Unauthorized: Admin access required.');
    }
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser || cleanUser.length < 3) {
      throw new Error('Username must be at least 3 characters.');
    }
    if (!password || password.length < 4) {
      throw new Error('Password must be at least 4 characters.');
    }

    const users = StorageService.getUsers();
    if (users.some(u => u.username.toLowerCase() === cleanUser)) {
      throw new Error('Username already exists.');
    }

    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      username: cleanUser,
      password,
      name: name.trim() || cleanUser,
      role: role === 'admin' ? 'admin' : 'user',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    StorageService.saveUsers(users);
    return newUser;
  }

  /**
   * Admin: Delete user and their associated tasks.
   */
  adminDeleteUser(userId) {
    if (!this.isAdmin()) {
      throw new Error('Unauthorized: Admin access required.');
    }
    if (userId === 'usr_admin') {
      throw new Error('Cannot delete the root System Admin account.');
    }
    if (this.currentUser && this.currentUser.id === userId) {
      throw new Error('Cannot delete your own active admin account.');
    }

    let users = StorageService.getUsers();
    users = users.filter(u => u.id !== userId);
    StorageService.saveUsers(users);

    // Cascade delete user's tasks
    let tasks = StorageService.getTasks();
    tasks = tasks.filter(t => t.userId !== userId);
    StorageService.saveTasks(tasks);

    return true;
  }
}
