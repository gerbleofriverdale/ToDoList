/**
 * TaskManager - Core domain logic for single and bulk task operations,
 * state transitions (start, pause, end/complete), and user task scoping.
 */
class TaskManager {
  constructor(authManager) {
    this.authManager = authManager;
    this.listeners = [];
  }

  subscribe(callback) {
    this.listeners.push(callback);
  }

  notify() {
    this.listeners.forEach(fn => fn());
  }

  /**
   * Returns tasks for the currently authenticated user, or all tasks if admin and specified.
   */
  getTasks(forUserId = null) {
    const allTasks = StorageService.getTasks();
    const currentUser = this.authManager.getCurrentUser();

    if (!currentUser) return [];

    if (this.authManager.isAdmin() && forUserId === 'ALL') {
      return allTasks;
    }

    const targetUserId = forUserId || currentUser.id;
    return allTasks.filter(t => {
      if (String(t.userId) === String(targetUserId)) return true;
      if (t.userId == targetUserId) return true;
      if (currentUser.username === 'demo' && (t.userId === 'usr_demo' || t.userId == 2 || t.userId === '2')) return true;
      if (currentUser.username === 'admin' && (t.userId === 'usr_admin' || t.userId == 1 || t.userId === '1')) return true;
      return false;
    });
  }

  /**
   * Syncs with Spring Boot backend when reachable.
   */
  async syncWithBackend() {
    try {
      const isAvailable = await ApiService.checkBackend();
      if (!isAvailable) return;

      const currentUser = this.authManager.getCurrentUser();
      if (!currentUser) return;

      const backendTasks = await ApiService.getTasks(currentUser);
      if (Array.isArray(backendTasks)) {
        StorageService.saveTasks(backendTasks);
        this.notify();
      }
    } catch (e) {
      console.warn('Backend sync deferred:', e);
    }
  }

  /**
   * Add a single task.
   */
  async addTask({ title, description = '', priority = 'medium', reminderTime = '', userId = null }) {
    const currentUser = this.authManager.getCurrentUser();
    if (!currentUser) throw new Error('You must be logged in to add tasks.');

    const cleanTitle = title?.trim();
    if (!cleanTitle) throw new Error('Task title cannot be empty.');

    const targetUserId = (this.authManager.isAdmin() && userId) ? userId : currentUser.id;

    // 1. Try backend
    try {
      if (await ApiService.checkBackend()) {
        const created = await ApiService.createTask({
          title: cleanTitle,
          description: description?.trim() || '',
          priority,
          reminderTime,
          userId: targetUserId
        }, currentUser);
        if (created) {
          const tasks = StorageService.getTasks();
          tasks.unshift(created);
          StorageService.saveTasks(tasks);
          this.notify();
          return created;
        }
      }
    } catch (e) {
      console.warn('Backend addTask failed, saving locally:', e);
    }

    // 2. Local fallback
    const newTask = {
      id: String(Date.now()),
      userId: String(targetUserId),
      title: cleanTitle,
      description: description?.trim() || '',
      priority: ['high', 'medium', 'low'].includes(priority) ? priority : 'medium',
      status: 'not-started',
      startedAt: null,
      elapsedSeconds: 0,
      reminderTime: reminderTime || '',
      createdAt: new Date().toISOString(),
      completedAt: null
    };

    const tasks = StorageService.getTasks();
    tasks.unshift(newTask);
    StorageService.saveTasks(tasks);
    this.notify();
    return newTask;
  }

  /**
   * Bulk add tasks from multi-line text input.
   */
  async bulkAddTasks(lines, { priority = 'medium', reminderTime = '', userId = null } = {}) {
    const currentUser = this.authManager.getCurrentUser();
    if (!currentUser) throw new Error('You must be logged in to add tasks.');

    const validLines = lines
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (validLines.length === 0) {
      throw new Error('Please enter at least one task line.');
    }

    const targetUserId = (this.authManager.isAdmin() && userId) ? userId : currentUser.id;

    // 1. Try backend
    try {
      if (await ApiService.checkBackend()) {
        const createdList = await ApiService.bulkCreateTasks(validLines, priority, reminderTime, targetUserId, currentUser);
        if (Array.isArray(createdList) && createdList.length > 0) {
          const tasks = StorageService.getTasks();
          StorageService.saveTasks([...createdList, ...tasks]);
          this.notify();
          return createdList;
        }
      }
    } catch (e) {
      console.warn('Backend bulkAddTasks failed, saving locally:', e);
    }

    // 2. Local fallback
    const now = Date.now();
    const createdTasks = [];
    validLines.forEach((lineText, idx) => {
      let itemPriority = priority;
      let cleanText = lineText;

      const priorityMatch = lineText.match(/^\[(h|high|m|medium|l|low)\]\s*(.+)$/i);
      if (priorityMatch) {
        const p = priorityMatch[1].toLowerCase();
        if (p === 'h' || p === 'high') itemPriority = 'high';
        else if (p === 'm' || p === 'medium') itemPriority = 'medium';
        else if (p === 'l' || p === 'low') itemPriority = 'low';
        cleanText = priorityMatch[2].trim();
      }

      createdTasks.push({
        id: `tsk_${now}_${idx}`,
        userId: String(targetUserId),
        title: cleanText,
        description: '',
        priority: itemPriority,
        status: 'not-started',
        startedAt: null,
        elapsedSeconds: 0,
        reminderTime: reminderTime || '',
        createdAt: new Date().toISOString(),
        completedAt: null
      });
    });

    const tasks = StorageService.getTasks();
    StorageService.saveTasks([...createdTasks, ...tasks]);
    this.notify();
    return createdTasks;
  }

  /**
   * Delete a single task.
   */
  async deleteTask(taskId) {
    const currentUser = this.authManager.getCurrentUser();
    if (!currentUser) throw new Error('Not logged in.');

    // 1. Try backend
    try {
      if (await ApiService.checkBackend()) {
        await ApiService.deleteTask(taskId, currentUser);
      }
    } catch (e) {
      console.warn('Backend deleteTask failed, deleting locally:', e);
    }

    // 2. Local state update
    let tasks = StorageService.getTasks();
    tasks = tasks.filter(t => String(t.id) !== String(taskId));
    StorageService.saveTasks(tasks);
    this.notify();
    return true;
  }

  /**
   * Bulk delete multiple tasks.
   */
  async bulkDeleteTasks(taskIds) {
    if (!Array.isArray(taskIds) || taskIds.length === 0) return 0;
    const currentUser = this.authManager.getCurrentUser();
    if (!currentUser) throw new Error('Not logged in.');

    // 1. Try backend
    try {
      if (await ApiService.checkBackend()) {
        await ApiService.bulkDeleteTasks(taskIds, currentUser);
      }
    } catch (e) {
      console.warn('Backend bulkDeleteTasks failed:', e);
    }

    // 2. Local state update
    const idStrings = new Set(taskIds.map(String));
    let tasks = StorageService.getTasks();
    const countBefore = tasks.length;
    tasks = tasks.filter(t => !idStrings.has(String(t.id)));
    StorageService.saveTasks(tasks);
    this.notify();
    return countBefore - tasks.length;
  }

  /**
   * Start a task (transitions to 'running').
   */
  async startTask(taskId) {
    const currentUser = this.authManager.getCurrentUser();

    // 1. Try backend
    try {
      if (await ApiService.checkBackend()) {
        const updated = await ApiService.startTask(taskId, currentUser);
        if (updated) {
          let tasks = StorageService.getTasks();
          const idx = tasks.findIndex(t => String(t.id) === String(taskId));
          if (idx !== -1) tasks[idx] = updated;
          else tasks.unshift(updated);
          StorageService.saveTasks(tasks);
          this.notify();
          return updated;
        }
      }
    } catch (e) {
      console.warn('Backend startTask failed, starting locally:', e);
    }

    // 2. Local state update
    const tasks = StorageService.getTasks();
    const task = tasks.find(t => String(t.id) === String(taskId));
    if (!task) throw new Error('Task not found.');

    task.status = 'running';
    task.startedAt = Date.now();
    StorageService.saveTasks(tasks);
    this.notify();
    return task;
  }

  /**
   * Pause a task (transitions from 'running' to 'paused', records elapsed duration).
   */
  async pauseTask(taskId) {
    const currentUser = this.authManager.getCurrentUser();

    // 1. Try backend
    try {
      if (await ApiService.checkBackend()) {
        const updated = await ApiService.pauseTask(taskId, currentUser);
        if (updated) {
          let tasks = StorageService.getTasks();
          const idx = tasks.findIndex(t => String(t.id) === String(taskId));
          if (idx !== -1) tasks[idx] = updated;
          else tasks.unshift(updated);
          StorageService.saveTasks(tasks);
          this.notify();
          return updated;
        }
      }
    } catch (e) {
      console.warn('Backend pauseTask failed, pausing locally:', e);
    }

    // 2. Local state update
    const tasks = StorageService.getTasks();
    const task = tasks.find(t => String(t.id) === String(taskId));
    if (!task) throw new Error('Task not found.');

    if (task.status === 'running' && task.startedAt) {
      const additional = Math.floor((Date.now() - task.startedAt) / 1000);
      task.elapsedSeconds = (task.elapsedSeconds || 0) + additional;
    }
    task.status = 'paused';
    task.startedAt = null;

    StorageService.saveTasks(tasks);
    this.notify();
    return task;
  }

  /**
   * End / complete a task (transitions to 'completed', stops timer).
   */
  async endTask(taskId) {
    const currentUser = this.authManager.getCurrentUser();

    // 1. Try backend
    try {
      if (await ApiService.checkBackend()) {
        const updated = await ApiService.endTask(taskId, currentUser);
        if (updated) {
          let tasks = StorageService.getTasks();
          const idx = tasks.findIndex(t => String(t.id) === String(taskId));
          if (idx !== -1) tasks[idx] = updated;
          else tasks.unshift(updated);
          StorageService.saveTasks(tasks);
          this.notify();
          return updated;
        }
      }
    } catch (e) {
      console.warn('Backend endTask failed, ending locally:', e);
    }

    // 2. Local state update
    const tasks = StorageService.getTasks();
    const task = tasks.find(t => String(t.id) === String(taskId));
    if (!task) throw new Error('Task not found.');

    if (task.status === 'running' && task.startedAt) {
      const additional = Math.floor((Date.now() - task.startedAt) / 1000);
      task.elapsedSeconds = (task.elapsedSeconds || 0) + additional;
    }
    task.status = 'completed';
    task.startedAt = null;
    task.completedAt = new Date().toISOString();

    StorageService.saveTasks(tasks);
    this.notify();
    return task;
  }

  /**
   * Bulk status update (e.g. start, pause, complete selected tasks).
   */
  async bulkUpdateStatus(taskIds, newStatus) {
    if (!Array.isArray(taskIds) || taskIds.length === 0) return 0;
    const currentUser = this.authManager.getCurrentUser();

    // 1. Try backend
    try {
      if (await ApiService.checkBackend()) {
        await ApiService.bulkUpdateStatus(taskIds, newStatus, currentUser);
      }
    } catch (e) {
      console.warn('Backend bulkUpdateStatus failed:', e);
    }

    // 2. Local update
    const idStrings = new Set(taskIds.map(String));
    const tasks = StorageService.getTasks();
    let updatedCount = 0;

    tasks.forEach(task => {
      if (idStrings.has(String(task.id))) {
        if (newStatus === 'running') {
          task.status = 'running';
          task.startedAt = Date.now();
          updatedCount++;
        } else if (newStatus === 'paused') {
          if (task.status === 'running' && task.startedAt) {
            const add = Math.floor((Date.now() - task.startedAt) / 1000);
            task.elapsedSeconds = (task.elapsedSeconds || 0) + add;
          }
          task.status = 'paused';
          task.startedAt = null;
          updatedCount++;
        } else if (newStatus === 'completed') {
          if (task.status === 'running' && task.startedAt) {
            const add = Math.floor((Date.now() - task.startedAt) / 1000);
            task.elapsedSeconds = (task.elapsedSeconds || 0) + add;
          }
          task.status = 'completed';
          task.startedAt = null;
          task.completedAt = new Date().toISOString();
          updatedCount++;
        }
      }
    });

    StorageService.saveTasks(tasks);
    this.notify();
    return updatedCount;
  }

  /**
   * Helper to compute active live elapsed time in seconds.
   */
  getLiveElapsedSeconds(task) {
    let total = task.elapsedSeconds || 0;
    if (task.status === 'running' && task.startedAt) {
      total += Math.floor((Date.now() - task.startedAt) / 1000);
    }
    return total;
  }

  /**
   * Get metrics for dashboard.
   */
  getMetrics(forUserId = null) {
    const tasks = this.getTasks(forUserId);
    return {
      total: tasks.length,
      running: tasks.filter(t => t.status === 'running').length,
      paused: tasks.filter(t => t.status === 'paused').length,
      completed: tasks.filter(t => t.status === 'completed').length
    };
  }
}
