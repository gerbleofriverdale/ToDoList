/**
 * StorageService - Manages persistence with LocalStorage and initial seed data.
 */
class StorageService {
  static USERS_KEY = 'focusflow_users_v1';
  static TASKS_KEY = 'focusflow_tasks_v1';
  static CURRENT_USER_KEY = 'focusflow_active_user_v1';

  static getDefaultUsers() {
    return [
      {
        id: '2',
        username: 'demo',
        password: 'demo123',
        name: 'Alex Rivera',
        role: 'user',
        createdAt: new Date().toISOString()
      },
      {
        id: '1',
        username: 'admin',
        password: 'admin123',
        name: 'System Admin',
        role: 'admin',
        createdAt: new Date().toISOString()
      }
    ];
  }

  static getDefaultTasks() {
    return [
      {
        id: '1',
        userId: '2',
        title: 'Design high-converting landing page',
        description: 'Create responsive UI mockups and review with product team',
        priority: 'high',
        status: 'running', // Started
        startedAt: Date.now() - 1000 * 60 * 18,
        elapsedSeconds: 1080,
        reminderTime: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString().slice(0, 16),
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        userId: '2',
        title: 'Review pull request for auth integration',
        description: 'Verify token validation and session persistence edge cases',
        priority: 'medium',
        status: 'paused',
        startedAt: null,
        elapsedSeconds: 720,
        reminderTime: '',
        createdAt: new Date().toISOString()
      },
      {
        id: '3',
        userId: '2',
        title: 'Weekly sprint planning presentation',
        description: 'Outline key milestones for the upcoming two-week sprint cycle',
        priority: 'low',
        status: 'completed',
        startedAt: null,
        elapsedSeconds: 2400,
        reminderTime: '',
        createdAt: new Date().toISOString()
      },
      {
        id: '4',
        userId: '2',
        title: 'Set up Windows notification permissions',
        description: 'Test Web Notification API native desktop alerts',
        priority: 'high',
        status: 'not-started',
        startedAt: null,
        elapsedSeconds: 0,
        reminderTime: '',
        createdAt: new Date().toISOString()
      },
      {
        id: '5',
        userId: '1',
        title: 'Audit system users and permissions',
        description: 'Ensure role separation and security integrity across tenant spaces',
        priority: 'high',
        status: 'not-started',
        startedAt: null,
        elapsedSeconds: 0,
        reminderTime: '',
        createdAt: new Date().toISOString()
      }
    ];
  }

  /**
   * Initializes default seed data if not present or empty.
   */
  static init() {
    const existingUsers = this.getUsers();
    if (!existingUsers || existingUsers.length === 0) {
      this.saveUsers(this.getDefaultUsers());
    }

    const existingTasks = this.getTasks();
    if (!existingTasks || existingTasks.length === 0) {
      this.saveTasks(this.getDefaultTasks());
    }

    // Default current user to demo user if none active
    const active = this.getCurrentUser();
    if (!active) {
      const users = this.getUsers();
      this.setCurrentUser(users.find(u => u.username === 'demo') || users[0]);
    }
  }

  static getUsers() {
    try {
      const raw = localStorage.getItem(this.USERS_KEY);
      if (!raw) return this.getDefaultUsers();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : this.getDefaultUsers();
    } catch (e) {
      console.error('Failed to read users from localStorage:', e);
      return this.getDefaultUsers();
    }
  }

  static saveUsers(users) {
    try {
      localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Failed to save users to localStorage:', e);
    }
  }

  static getCurrentUser() {
    try {
      const raw = localStorage.getItem(this.CURRENT_USER_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to read current user:', e);
      return null;
    }
  }

  static setCurrentUser(user) {
    try {
      if (user) {
        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(this.CURRENT_USER_KEY);
      }
    } catch (e) {
      console.error('Failed to set current user:', e);
    }
  }

  static getTasks() {
    try {
      const raw = localStorage.getItem(this.TASKS_KEY);
      if (!raw) {
        const defaults = this.getDefaultTasks();
        this.saveTasks(defaults);
        return defaults;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const defaults = this.getDefaultTasks();
        this.saveTasks(defaults);
        return defaults;
      }
      return parsed;
    } catch (e) {
      console.error('Failed to read tasks:', e);
      return this.getDefaultTasks();
    }
  }

  static saveTasks(tasks) {
    try {
      localStorage.setItem(this.TASKS_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.error('Failed to save tasks:', e);
    }
  }
}
