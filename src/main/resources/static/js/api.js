/**
 * ApiService - Client for communicating with Spring Boot REST API (/api).
 * Automatically detects whether Spring Boot backend is active,
 * enabling seamless dual-mode operation (Live Spring Boot or Standalone).
 */
class ApiService {
  static BASE_URL = window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:8080';
  static isBackendAvailable = null;

  static async checkBackend() {
    if (this.isBackendAvailable !== null) return this.isBackendAvailable;
    try {
      const res = await fetch(`${this.BASE_URL}/api/tasks`, {
        method: 'GET',
        headers: { 'X-User-Id': '2' },
        signal: AbortSignal.timeout(1500)
      });
      this.isBackendAvailable = res.ok || res.status === 401;
    } catch (e) {
      this.isBackendAvailable = false;
    }
    return this.isBackendAvailable;
  }

  static getHeaders(currentUser = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (currentUser) {
      headers['X-User-Id'] = String(currentUser.id || 2);
      headers['X-User-Role'] = currentUser.role || 'user';
    }
    return headers;
  }

  // --- Auth Endpoints ---
  static async login(username, password) {
    const res = await fetch(`${this.BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Invalid credentials');
    }
    return await res.json();
  }

  static async register(name, username, password) {
    const res = await fetch(`${this.BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(err.error || 'Failed to create user');
    }
    return await res.json();
  }

  // --- Task Endpoints ---
  static async getTasks(currentUser) {
    const res = await fetch(`${this.BASE_URL}/api/tasks`, {
      method: 'GET',
      headers: this.getHeaders(currentUser)
    });
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return await res.json();
  }

  static async createTask(taskData, currentUser) {
    const res = await fetch(`${this.BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: this.getHeaders(currentUser),
      body: JSON.stringify(taskData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create task' }));
      throw new Error(err.error || 'Failed to create task');
    }
    return await res.json();
  }

  static async bulkCreateTasks(lines, priority, reminderTime, assignedUserId, currentUser) {
    const res = await fetch(`${this.BASE_URL}/api/tasks/bulk`, {
      method: 'POST',
      headers: this.getHeaders(currentUser),
      body: JSON.stringify({
        lines,
        defaultPriority: priority,
        reminderTime,
        userId: assignedUserId
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Bulk creation failed' }));
      throw new Error(err.error || 'Bulk creation failed');
    }
    return await res.json();
  }

  static async startTask(taskId, currentUser) {
    const res = await fetch(`${this.BASE_URL}/api/tasks/${taskId}/start`, {
      method: 'POST',
      headers: this.getHeaders(currentUser)
    });
    if (!res.ok) throw new Error('Failed to start task');
    return await res.json();
  }

  static async pauseTask(taskId, currentUser) {
    const res = await fetch(`${this.BASE_URL}/api/tasks/${taskId}/pause`, {
      method: 'POST',
      headers: this.getHeaders(currentUser)
    });
    if (!res.ok) throw new Error('Failed to pause task');
    return await res.json();
  }

  static async endTask(taskId, currentUser) {
    const res = await fetch(`${this.BASE_URL}/api/tasks/${taskId}/end`, {
      method: 'POST',
      headers: this.getHeaders(currentUser)
    });
    if (!res.ok) throw new Error('Failed to complete task');
    return await res.json();
  }

  static async bulkUpdateStatus(taskIds, status, currentUser) {
    const res = await fetch(`${this.BASE_URL}/api/tasks/bulk-status`, {
      method: 'POST',
      headers: this.getHeaders(currentUser),
      body: JSON.stringify({ taskIds, status })
    });
    if (!res.ok) throw new Error('Failed to update tasks');
    return await res.json();
  }

  static async deleteTask(taskId, currentUser) {
    const res = await fetch(`${this.BASE_URL}/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: this.getHeaders(currentUser)
    });
    if (!res.ok) throw new Error('Failed to delete task');
    return await res.json();
  }

  static async bulkDeleteTasks(taskIds, currentUser) {
    const res = await fetch(`${this.BASE_URL}/api/tasks/bulk-delete`, {
      method: 'POST',
      headers: this.getHeaders(currentUser),
      body: JSON.stringify({ taskIds })
    });
    if (!res.ok) throw new Error('Bulk delete failed');
    return await res.json();
  }

  static async getStats(currentUser) {
    const res = await fetch(`${this.BASE_URL}/api/tasks/stats`, {
      headers: this.getHeaders(currentUser)
    });
    if (!res.ok) throw new Error('Failed to fetch stats');
    return await res.json();
  }

  // --- Admin Endpoints ---
  static async adminGetUsers(currentUser) {
    const res = await fetch(`${this.BASE_URL}/api/admin/users`, {
      headers: this.getHeaders(currentUser)
    });
    if (!res.ok) throw new Error('Admin access required');
    return await res.json();
  }

  static async adminCreateUser(userData, currentUser) {
    const res = await fetch(`${this.BASE_URL}/api/admin/users?targetRole=${userData.role || 'user'}`, {
      method: 'POST',
      headers: this.getHeaders(currentUser),
      body: JSON.stringify(userData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create user' }));
      throw new Error(err.error || 'Failed to create user');
    }
    return await res.json();
  }

  static async adminDeleteUser(userId, currentUser) {
    const res = await fetch(`${this.BASE_URL}/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: this.getHeaders(currentUser)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Delete failed' }));
      throw new Error(err.error || 'Delete failed');
    }
    return await res.json();
  }

  static async adminGetAllTasks(filterUserId, currentUser) {
    const url = filterUserId && filterUserId !== 'ALL' 
      ? `${this.BASE_URL}/api/admin/tasks?userId=${filterUserId}`
      : `${this.BASE_URL}/api/admin/tasks`;
    const res = await fetch(url, {
      headers: this.getHeaders(currentUser)
    });
    if (!res.ok) throw new Error('Failed to load system tasks');
    return await res.json();
  }

  static async adminDeleteTask(taskId, currentUser) {
    const res = await fetch(`${this.BASE_URL}/api/admin/tasks/${taskId}`, {
      method: 'DELETE',
      headers: this.getHeaders(currentUser)
    });
    if (!res.ok) throw new Error('Failed to delete task');
    return await res.json();
  }
}
