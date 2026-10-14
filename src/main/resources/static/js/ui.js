/**
 * UIManager - Coordinates all DOM updates, events, reactive renders,
 * timers, modals, toasts, and admin view rendering.
 */
class UIManager {
  constructor(authManager, taskManager, notificationService, motivationalEngine) {
    this.auth = authManager;
    this.tasks = taskManager;
    this.notifications = notificationService;
    this.motivation = motivationalEngine;

    // Local UI State
    this.statusFilter = 'all';
    this.priorityFilter = 'all';
    this.searchQuery = '';
    this.selectedTaskIds = new Set();
    this.liveTimerInterval = null;

    // Cached Elements
    this.tasksListContainer = document.getElementById('tasksListContainer');
    this.tasksCountBadge = document.getElementById('tasksCountBadge');
    this.selectAllCheckbox = document.getElementById('selectAllCheckbox');
    this.bulkActionBar = document.getElementById('bulkActionBar');
    this.bulkSelectedCount = document.getElementById('bulkSelectedCount');
    this.toastContainer = document.getElementById('toastContainer');

    // Register toast handler with notification service
    this.notifications.setToastHandler((title, msg, type) => this.showToast(title, msg, type));

    this.bindEvents();
    this.startLiveTimer();
  }

  /**
   * Format seconds into MM:SS or HH:MM:SS
   */
  formatDuration(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;

    const pad = (n) => String(n).padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Update header user profile & controls
   */
  renderHeaderUser() {
    const user = this.auth.getCurrentUser();
    const userBadge = document.getElementById('userProfileBadge');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userRoleTag = document.getElementById('userRoleTag');
    const btnOpenAdmin = document.getElementById('btnOpenAdmin');
    const btnAuthAction = document.getElementById('btnAuthAction');

    if (user) {
      userAvatar.textContent = user.name ? user.name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase();
      userName.textContent = user.name || user.username;
      userRoleTag.textContent = user.role.toUpperCase();
      userRoleTag.className = `user-role-tag ${user.role === 'admin' ? 'role-admin' : 'role-user'}`;
      btnOpenAdmin.style.display = user.role === 'admin' ? 'inline-flex' : 'none';
      btnAuthAction.innerHTML = '<span>Log Out</span>';
      btnAuthAction.title = 'Sign out of current account';
    } else {
      userAvatar.textContent = '?';
      userName.textContent = 'Guest';
      userRoleTag.textContent = 'None';
      userRoleTag.className = 'user-role-tag';
      btnOpenAdmin.style.display = 'none';
      btnAuthAction.innerHTML = '<span>Log In</span>';
      btnAuthAction.title = 'Log in with your username and password';
    }

    // Windows notification state
    this.updateNotificationButtonState();
  }

  updateNotificationButtonState() {
    const btn = document.getElementById('btnNotifPermission');
    const label = document.getElementById('notifLabel');
    const perm = this.notifications.getPermission();
    const isAlertsOn = perm === 'granted' && this.notifications.enabled;

    if (isAlertsOn) {
      btn.classList.add('active');
      label.textContent = 'Alerts On';
      btn.title = 'Windows desktop notifications are active (Click to turn off)';
    } else if (perm === 'granted' && !this.notifications.enabled) {
      btn.classList.remove('active');
      label.textContent = 'Alerts Off';
      btn.title = 'Alerts are muted (Click to turn on)';
    } else if (perm === 'denied') {
      btn.classList.remove('active');
      label.textContent = 'Alerts Blocked';
      btn.title = 'Notifications are blocked in your browser settings';
    } else {
      btn.classList.remove('active');
      label.textContent = 'Enable Alerts';
      btn.title = 'Click to enable native Windows desktop notifications';
    }
  }

  /**
   * Render metrics cards
   */
  renderMetrics() {
    const metrics = this.tasks.getMetrics();
    document.getElementById('metricTotal').textContent = metrics.total;
    document.getElementById('metricRunning').textContent = metrics.running;
    document.getElementById('metricPaused').textContent = metrics.paused;
    document.getElementById('metricCompleted').textContent = metrics.completed;
  }

  /**
   * Render tasks list based on current filters and search
   */
  renderTasks() {
    const allUserTasks = this.tasks.getTasks();

    // Filter tasks
    let filtered = allUserTasks.filter(task => {
      // Status filter
      if (this.statusFilter !== 'all' && task.status !== this.statusFilter) {
        return false;
      }
      // Priority filter
      if (this.priorityFilter !== 'all' && task.priority !== this.priorityFilter) {
        return false;
      }
      // Search query
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const inTitle = task.title.toLowerCase().includes(q);
        const inDesc = (task.description || '').toLowerCase().includes(q);
        if (!inTitle && !inDesc) return false;
      }
      return true;
    });

    this.tasksCountBadge.textContent = `${filtered.length} task${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
      this.tasksListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h3>No tasks found</h3>
          <p>${this.searchQuery ? 'No tasks match your search criteria. Try a different query.' : 'You have no tasks in this view. Click "+ New Task" or "Bulk Add" above to start getting things done!'}</p>
        </div>
      `;
      this.updateBulkActionBar();
      return;
    }

    // Generate HTML for each task
    this.tasksListContainer.innerHTML = filtered.map(task => {
      const isSelected = this.selectedTaskIds.has(task.id);
      const isRunning = task.status === 'running';
      const isPaused = task.status === 'paused';
      const isCompleted = task.status === 'completed';
      const isNotStarted = task.status === 'not-started';

      const liveElapsed = this.tasks.getLiveElapsedSeconds(task);
      const formattedTime = this.formatDuration(liveElapsed);

      // Status badge label
      let statusBadgeLabel = 'Not Started';
      if (isRunning) statusBadgeLabel = 'In Progress';
      else if (isPaused) statusBadgeLabel = 'Paused';
      else if (isCompleted) statusBadgeLabel = 'Completed';

      // Reminder display
      let reminderBadge = '';
      if (task.reminderTime) {
        const remDate = new Date(task.reminderTime);
        const remStr = remDate.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        reminderBadge = `<span class="reminder-badge" title="Windows Reminder Set">⏰ ${remStr}</span>`;
      }

      return `
        <article class="task-item status-${task.status} ${isSelected ? 'selected' : ''}" data-task-id="${task.id}">
          <div class="task-left">
            <div class="custom-checkbox ${isSelected ? 'checked' : ''}" data-action="toggle-select" data-task-id="${task.id}" title="Select for bulk action"></div>
            
            <div class="task-content">
              <h3 class="task-title" title="${this.escapeHTML(task.title)}">${this.escapeHTML(task.title)}</h3>
              ${task.description ? `<p class="task-description">${this.escapeHTML(task.description)}</p>` : ''}
              
              <div class="task-meta">
                <span class="badge badge-priority-${task.priority}">
                  ${task.priority === 'high' ? '🔥 High' : task.priority === 'medium' ? '⚡ Medium' : '🌱 Low'}
                </span>

                <span class="badge badge-status badge-status-${task.status}">
                  ${statusBadgeLabel}
                </span>

                <span class="timer-badge" id="timer-${task.id}">
                  ${isRunning ? '⏱️' : isPaused ? '⏸️' : '⏱️'} ${formattedTime}
                </span>

                ${reminderBadge}
              </div>
            </div>
          </div>

          <div class="task-actions">
            ${isNotStarted ? `
              <button class="btn btn-sm btn-start" data-action="start" data-task-id="${task.id}" title="Start working on task">
                ▶ Start
              </button>
            ` : ''}

            ${isRunning ? `
              <button class="btn btn-sm btn-pause" data-action="pause" data-task-id="${task.id}" title="Pause task">
                ⏸ Pause
              </button>
              <button class="btn btn-sm btn-end" data-action="end" data-task-id="${task.id}" title="Complete & celebrate task">
                ✓ End
              </button>
            ` : ''}

            ${isPaused ? `
              <button class="btn btn-sm btn-start" data-action="start" data-task-id="${task.id}" title="Resume working on task">
                ▶ Resume
              </button>
              <button class="btn btn-sm btn-end" data-action="end" data-task-id="${task.id}" title="Complete & celebrate task">
                ✓ End
              </button>
            ` : ''}

            ${isCompleted ? `
              <button class="btn btn-sm btn-ghost" disabled style="opacity: 0.7; color: var(--color-completed);">
                ✓ Finished
              </button>
            ` : ''}

            <button class="btn btn-icon btn-ghost btn-sm" data-action="delete" data-task-id="${task.id}" title="Delete task" style="color: var(--text-muted);">
              🗑️
            </button>
          </div>
        </article>
      `;
    }).join('');

    this.updateBulkActionBar();
    this.updateSelectAllCheckboxState(filtered);
  }

  /**
   * Real-time 1s interval that updates the timer badges of any active running tasks
   */
  startLiveTimer() {
    if (this.liveTimerInterval) clearInterval(this.liveTimerInterval);

    this.liveTimerInterval = setInterval(() => {
      const runningTasks = this.tasks.getTasks().filter(t => t.status === 'running');
      runningTasks.forEach(task => {
        const timerEl = document.getElementById(`timer-${task.id}`);
        if (timerEl) {
          const liveSeconds = this.tasks.getLiveElapsedSeconds(task);
          timerEl.innerHTML = `⏱️ ${this.formatDuration(liveSeconds)}`;
        }
      });
    }, 1000);
  }

  /**
   * Update Bulk Action floating bar
   */
  updateBulkActionBar() {
    const count = this.selectedTaskIds.size;
    this.bulkSelectedCount.textContent = count;
    if (count > 0) {
      this.bulkActionBar.classList.add('visible');
    } else {
      this.bulkActionBar.classList.remove('visible');
    }
  }

  updateSelectAllCheckboxState(filteredTasks) {
    if (filteredTasks.length === 0) {
      this.selectAllCheckbox.checked = false;
      this.selectAllCheckbox.indeterminate = false;
      return;
    }

    const visibleIds = filteredTasks.map(t => t.id);
    const selectedVisibleCount = visibleIds.filter(id => this.selectedTaskIds.has(id)).length;

    if (selectedVisibleCount === 0) {
      this.selectAllCheckbox.checked = false;
      this.selectAllCheckbox.indeterminate = false;
    } else if (selectedVisibleCount === visibleIds.length) {
      this.selectAllCheckbox.checked = true;
      this.selectAllCheckbox.indeterminate = false;
    } else {
      this.selectAllCheckbox.checked = false;
      this.selectAllCheckbox.indeterminate = true;
    }
  }

  /**
   * Modal handling
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      const firstInput = modal.querySelector('input:not([type="hidden"]), textarea, select');
      if (firstInput) setTimeout(() => firstInput.focus(), 100);
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  }

  /**
   * Toast messaging system
   */
  showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type === 'celebration' ? 'celebration' : type === 'pause' ? 'pause' : type === 'motivational' ? 'motivational' : 'info'}`;

    let icon = '🔔';
    if (type === 'celebration') icon = '🎉';
    else if (type === 'pause') icon = '☕';
    else if (type === 'reminder') icon = '⏰';
    else if (type === 'motivational') icon = '✨';
    else if (type === 'danger') icon = '⚠️';

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <div class="toast-title">${this.escapeHTML(title)}</div>
        <div class="toast-message">${this.escapeHTML(message)}</div>
      </div>
      <button class="toast-close" aria-label="Close notification">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });

    this.toastContainer.appendChild(toast);

    // Auto-remove after 6 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 6000);
  }

  /**
   * Celebration dialog trigger on task completion
   */
  showCelebration(task) {
    const quoteObj = this.motivation.getRandomCompletionQuote();
    const liveElapsed = this.tasks.getLiveElapsedSeconds(task);

    document.getElementById('celebrationTaskName').textContent = `"${task.title}"`;
    document.getElementById('celebrationQuote').textContent = `"${quoteObj.text}"`;
    document.getElementById('celebrationAuthor').textContent = `— ${quoteObj.author}`;
    document.getElementById('celebrationTimeSpent').textContent = `⏱ Time Invested: ${this.formatDuration(liveElapsed)}`;

    this.openModal('modalCelebration');
    this.motivation.launchConfetti();
  }

  /**
   * Admin Panel Render
   */
  renderAdminPanel() {
    if (!this.auth.isAdmin()) return;

    // Render Users Table
    const users = this.auth.getAllUsers();
    const allTasks = StorageService.getTasks();
    const tbodyUsers = document.getElementById('adminUsersTableBody');

    tbodyUsers.innerHTML = users.map(user => {
      const taskCount = allTasks.filter(t => t.userId === user.id).length;
      const joinedDate = new Date(user.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const isRootAdmin = user.id === 'usr_admin';
      const isSelf = user.id === this.auth.getCurrentUser().id;

      return `
        <tr>
          <td>
            <strong>${this.escapeHTML(user.name || user.username)}</strong>
          </td>
          <td><code>@${this.escapeHTML(user.username)}</code></td>
          <td>
            <span class="user-role-tag ${user.role === 'admin' ? 'role-admin' : 'role-user'}">
              ${user.role}
            </span>
          </td>
          <td>${taskCount} task${taskCount === 1 ? '' : 's'}</td>
          <td>${joinedDate}</td>
          <td>
            ${isRootAdmin || isSelf ? `
              <span style="font-size: 0.75rem; color: var(--text-muted);">(Protected)</span>
            ` : `
              <button class="btn btn-sm btn-danger btn-admin-delete-user" data-user-id="${user.id}" data-username="${this.escapeHTML(user.username)}">
                Delete User
              </button>
            `}
          </td>
        </tr>
      `;
    }).join('');

    // Populate user assignment dropdowns
    this.populateUserDropdowns(users);

    // Render All Tasks Table
    this.renderAdminTasksTable();
  }

  populateUserDropdowns(users) {
    const singleSelect = document.getElementById('adminAssignUserSelect');
    const bulkSelect = document.getElementById('adminBulkAssignUserSelect');
    const filterSelect = document.getElementById('adminFilterByUserSelect');
    const currentUserId = this.auth.getCurrentUser()?.id;

    const options = users.map(u => 
      `<option value="${u.id}" ${u.id === currentUserId ? 'selected' : ''}>${this.escapeHTML(u.name || u.username)} (@${this.escapeHTML(u.username)})</option>`
    ).join('');

    if (singleSelect) singleSelect.innerHTML = options;
    if (bulkSelect) bulkSelect.innerHTML = options;

    if (filterSelect) {
      filterSelect.innerHTML = `<option value="ALL">All Users (System-wide)</option>` + options;
    }
  }

  renderAdminTasksTable() {
    const filterSelect = document.getElementById('adminFilterByUserSelect');
    const targetUserId = filterSelect ? filterSelect.value : 'ALL';

    const allTasks = StorageService.getTasks();
    const users = StorageService.getUsers();
    const userMap = new Map(users.map(u => [u.id, u.name || u.username]));

    const filtered = (targetUserId === 'ALL') 
      ? allTasks 
      : allTasks.filter(t => t.userId === targetUserId);

    const tbody = document.getElementById('adminTasksTableBody');
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">No tasks recorded for this selection.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(t => {
      const userName = userMap.get(t.userId) || 'Unknown User';
      const liveElapsed = this.tasks.getLiveElapsedSeconds(t);
      return `
        <tr>
          <td><strong>${this.escapeHTML(t.title)}</strong></td>
          <td>${this.escapeHTML(userName)}</td>
          <td><span class="badge badge-priority-${t.priority}">${t.priority}</span></td>
          <td><span class="badge badge-status badge-status-${t.status}">${t.status}</span></td>
          <td>${this.formatDuration(liveElapsed)}</td>
          <td>
            <button class="btn btn-sm btn-danger btn-admin-delete-task" data-task-id="${t.id}">Delete</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Search input
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim();
      this.renderTasks();
    });

    // Filter status & priority buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = btn.getAttribute('data-filter-type');
        const val = btn.getAttribute('data-filter-value');

        // Toggle active class in group
        btn.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (type === 'status') {
          this.statusFilter = val;
        } else if (type === 'priority') {
          this.priorityFilter = val;
        }

        this.renderTasks();
      });
    });

    // Select All Checkbox
    this.selectAllCheckbox.addEventListener('change', (e) => {
      const allTasks = this.tasks.getTasks();
      if (e.target.checked) {
        allTasks.forEach(t => this.selectedTaskIds.add(t.id));
      } else {
        this.selectedTaskIds.clear();
      }
      this.renderTasks();
    });

    // Task List Item Delegated Actions
    this.tasksListContainer.addEventListener('click', async (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.getAttribute('data-action');
      const taskId = target.getAttribute('data-task-id');

      if (action === 'toggle-select') {
        if (this.selectedTaskIds.has(taskId)) {
          this.selectedTaskIds.delete(taskId);
        } else {
          this.selectedTaskIds.add(taskId);
        }
        this.renderTasks();
      } else if (action === 'start') {
        try {
          const task = await this.tasks.startTask(taskId);
          if (task) {
            this.notifications.send(`▶ Task Started: ${task.title}`, {
              body: 'Great start! Focus on this task and make progress.',
              toastType: 'motivational',
              sound: 'chime'
            });
          }
          this.renderTasks();
          this.renderMetrics();
        } catch (err) {
          console.error('Failed to start task:', err);
        }
      } else if (action === 'pause') {
        try {
          const task = await this.tasks.pauseTask(taskId);
          if (task) {
            const pauseQuote = this.motivation.getRandomPauseQuote();
            this.notifications.send(`⏸ Task Paused: ${task.title}`, {
              body: `${pauseQuote.text}`,
              toastType: 'pause',
              sound: 'pause'
            });
          }
          this.renderTasks();
          this.renderMetrics();
        } catch (err) {
          console.error('Failed to pause task:', err);
        }
      } else if (action === 'end') {
        try {
          const task = await this.tasks.endTask(taskId);
          if (task) {
            this.notifications.send(`🎉 Task Finished!`, {
              body: `You completed "${task.title}"! Fantastic achievement!`,
              toastType: 'celebration',
              sound: 'celebrate'
            });
            this.showCelebration(task);
          }
          this.renderTasks();
          this.renderMetrics();
        } catch (err) {
          console.error('Failed to end task:', err);
        }
      } else if (action === 'delete') {
        if (confirm('Are you sure you want to delete this task?')) {
          this.selectedTaskIds.delete(taskId);
          await this.tasks.deleteTask(taskId);
          this.showToast('Task Deleted', 'The task has been removed.', 'info');
          this.renderTasks();
          this.renderMetrics();
        }
      }
    });

    // Floating Bulk Action Bar buttons
    document.getElementById('btnBulkStart').addEventListener('click', async () => {
      const ids = Array.from(this.selectedTaskIds);
      await this.tasks.bulkUpdateStatus(ids, 'running');
      this.showToast('Bulk Started', `Started ${ids.length} selected tasks.`, 'info');
      this.selectedTaskIds.clear();
      this.renderTasks();
      this.renderMetrics();
    });

    document.getElementById('btnBulkPause').addEventListener('click', async () => {
      const ids = Array.from(this.selectedTaskIds);
      await this.tasks.bulkUpdateStatus(ids, 'paused');
      const pauseQuote = this.motivation.getRandomPauseQuote();
      this.showToast('Bulk Paused', pauseQuote.text, 'pause');
      this.selectedTaskIds.clear();
      this.renderTasks();
      this.renderMetrics();
    });

    document.getElementById('btnBulkComplete').addEventListener('click', async () => {
      const ids = Array.from(this.selectedTaskIds);
      await this.tasks.bulkUpdateStatus(ids, 'completed');
      this.motivation.launchConfetti();
      this.notifications.playChime('celebrate');
      this.showToast('Bulk Completed! 🎉', `Successfully completed ${ids.length} tasks! Fantastic!`, 'celebration');
      this.selectedTaskIds.clear();
      this.renderTasks();
      this.renderMetrics();
    });

    document.getElementById('btnBulkDelete').addEventListener('click', async () => {
      const ids = Array.from(this.selectedTaskIds);
      if (confirm(`Are you sure you want to delete ${ids.length} selected tasks?`)) {
        await this.tasks.bulkDeleteTasks(ids);
        this.selectedTaskIds.clear();
        this.showToast('Bulk Deleted', `${ids.length} tasks removed.`, 'info');
        this.renderTasks();
        this.renderMetrics();
      }
    });

    document.getElementById('btnBulkDeselect').addEventListener('click', () => {
      this.selectedTaskIds.clear();
      this.renderTasks();
    });

    // Modal Close Buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-modal');
        this.closeModal(modalId);
      });
    });

    // Close modal on background click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });

    // Close Celebration Modal Button
    document.getElementById('btnCloseCelebration').addEventListener('click', () => {
      this.closeModal('modalCelebration');
    });

    // Windows Notification Toggle Button
    document.getElementById('btnNotifPermission').addEventListener('click', async () => {
      const perm = this.notifications.getPermission();
      if (perm === 'granted') {
        const nowEnabled = this.notifications.toggle();
        this.updateNotificationButtonState();
        if (nowEnabled) {
          this.showToast('Alerts Enabled', 'Windows notifications and sound are now active.', 'celebration');
        } else {
          this.showToast('Alerts Muted', 'Windows notifications and sound are turned off.', 'info');
        }
      } else {
        const newPerm = await this.notifications.requestPermission();
        this.notifications.enabled = (newPerm === 'granted');
        localStorage.setItem('focusflow_alerts_enabled', String(this.notifications.enabled));
        this.updateNotificationButtonState();
        if (newPerm === 'granted') {
          this.showToast('Windows Notifications Active', 'You will now receive native desktop alerts.', 'celebration');
        } else if (newPerm === 'denied') {
          this.showToast('Permission Blocked', 'Please enable notifications in your browser address bar settings.', 'danger');
        }
      }
    });

    // Single Add Task Modal Triggers
    document.getElementById('btnOpenSingleAdd').addEventListener('click', () => {
      // If admin, show user assignment row
      const adminRow = document.getElementById('adminAssignUserRow');
      if (adminRow) {
        adminRow.style.display = this.auth.isAdmin() ? 'block' : 'none';
      }
      this.openModal('modalSingleAdd');
    });

    // Single Add Form Submit
    document.getElementById('formSingleAdd').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('taskTitleInput').value;
      const description = document.getElementById('taskDescInput').value;
      const priority = document.getElementById('taskPrioritySelect').value;
      const reminderTime = document.getElementById('taskReminderInput').value;
      const assignedUserId = this.auth.isAdmin() ? document.getElementById('adminAssignUserSelect').value : null;

      try {
        await this.tasks.addTask({
          title,
          description,
          priority,
          reminderTime,
          userId: assignedUserId
        });

        this.showToast('Task Created', `"${title}" has been added!`, 'info');
        e.target.reset();
        this.closeModal('modalSingleAdd');
        this.renderTasks();
        this.renderMetrics();
      } catch (err) {
        alert(err.message);
      }
    });

    // Bulk Add Task Modal Triggers
    document.getElementById('btnOpenBulkAdd').addEventListener('click', () => {
      const adminRow = document.getElementById('adminBulkAssignUserRow');
      if (adminRow) {
        adminRow.style.display = this.auth.isAdmin() ? 'block' : 'none';
      }
      this.openModal('modalBulkAdd');
    });

    // Bulk Add Form Submit
    document.getElementById('formBulkAdd').addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = document.getElementById('bulkTasksTextarea').value;
      const priority = document.getElementById('bulkDefaultPriority').value;
      const assignedUserId = this.auth.isAdmin() ? document.getElementById('adminBulkAssignUserSelect').value : null;

      const lines = text.split('\n');

      try {
        const created = await this.tasks.bulkAddTasks(lines, {
          priority,
          userId: assignedUserId
        });

        this.showToast('Bulk Tasks Added', `Created ${created.length} new tasks!`, 'celebration');
        e.target.reset();
        this.closeModal('modalBulkAdd');
        this.renderTasks();
        this.renderMetrics();
      } catch (err) {
        alert(err.message);
      }
    });

    // Auth Trigger
    document.getElementById('userProfileBadge').addEventListener('click', () => {
      this.openModal('modalAuth');
    });

    document.getElementById('btnAuthAction').addEventListener('click', () => {
      const currentUser = this.auth.getCurrentUser();
      if (currentUser) {
        if (confirm(`Are you sure you want to log out of @${currentUser.username}?`)) {
          this.auth.logout();
          this.showToast('Logged Out', 'You have been signed out successfully.', 'info');
          this.selectedTaskIds.clear();
          this.renderHeaderUser();
          this.renderTasks();
          this.renderMetrics();
          this.openModal('modalAuth');
        }
      } else {
        this.openModal('modalAuth');
      }
    });

    // Auth Tabs (Login / Register)
    const tabLogin = document.getElementById('tabAuthLogin');
    const tabRegister = document.getElementById('tabAuthRegister');
    const formLogin = document.getElementById('formLogin');
    const formRegister = document.getElementById('formRegister');

    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      formLogin.style.display = 'block';
      formRegister.style.display = 'none';
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      formRegister.style.display = 'block';
      formLogin.style.display = 'none';
    });

    // Login Form Submit (Requires valid Username & Password)
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('loginUsername').value;
      const p = document.getElementById('loginPassword').value;

      try {
        const user = await this.auth.login(u, p);
        this.showToast('Welcome Back', `Logged in as ${user.name || user.username}.`, 'celebration');
        e.target.reset();
        this.closeModal('modalAuth');
        this.selectedTaskIds.clear();
        await this.tasks.syncWithBackend();
        this.renderHeaderUser();
        this.renderTasks();
        this.renderMetrics();
      } catch (err) {
        alert(err.message);
      }
    });

    // Register Form Submit
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('regName').value;
      const username = document.getElementById('regUsername').value;
      const password = document.getElementById('regPassword').value;

      try {
        const newUser = await this.auth.register({ name, username, password });
        this.showToast('Account Created!', `Welcome, ${newUser.name}! Your task workspace is ready.`, 'celebration');
        e.target.reset();
        this.closeModal('modalAuth');
        this.selectedTaskIds.clear();
        await this.tasks.syncWithBackend();
        this.renderHeaderUser();
        this.renderTasks();
        this.renderMetrics();
      } catch (err) {
        alert(err.message);
      }
    });

    // Admin Dashboard Button
    document.getElementById('btnOpenAdmin').addEventListener('click', () => {
      this.renderAdminPanel();
      this.openModal('modalAdmin');
    });

    // Admin Panel Tabs
    const tabAdminUsers = document.getElementById('tabAdminUsers');
    const tabAdminTasks = document.getElementById('tabAdminTasks');
    const sectionUsers = document.getElementById('adminUsersSection');
    const sectionTasks = document.getElementById('adminTasksSection');

    tabAdminUsers.addEventListener('click', () => {
      tabAdminUsers.classList.add('active');
      tabAdminTasks.classList.remove('active');
      sectionUsers.style.display = 'block';
      sectionTasks.style.display = 'none';
      this.renderAdminPanel();
    });

    tabAdminTasks.addEventListener('click', () => {
      tabAdminTasks.classList.add('active');
      tabAdminUsers.classList.remove('active');
      sectionTasks.style.display = 'block';
      sectionUsers.style.display = 'none';
      this.renderAdminTasksTable();
    });

    // Admin toggle new user form
    const btnToggleNewUser = document.getElementById('btnToggleNewUserForm');
    const cardCreateUser = document.getElementById('adminCreateUserCard');
    const btnCancelNewUser = document.getElementById('btnCancelNewUser');

    btnToggleNewUser.addEventListener('click', () => {
      cardCreateUser.style.display = cardCreateUser.style.display === 'none' ? 'block' : 'none';
    });

    btnCancelNewUser.addEventListener('click', () => {
      cardCreateUser.style.display = 'none';
    });

    // Admin create user form submit
    document.getElementById('formAdminCreateUser').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('adminNewName').value;
      const username = document.getElementById('adminNewUsername').value;
      const password = document.getElementById('adminNewPassword').value;
      const role = document.getElementById('adminNewRole').value;

      try {
        this.auth.adminCreateUser({ name, username, password, role });
        this.showToast('User Created', `User @${username} added successfully.`, 'info');
        e.target.reset();
        cardCreateUser.style.display = 'none';
        this.renderAdminPanel();
      } catch (err) {
        alert(err.message);
      }
    });

    // Admin Users Table Actions (Delete User)
    document.getElementById('adminUsersTableBody').addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-admin-delete-user');
      if (!btn) return;

      const userId = btn.getAttribute('data-user-id');
      const username = btn.getAttribute('data-username');

      if (confirm(`Are you sure you want to permanently delete user "@${username}" and all of their tasks?`)) {
        try {
          this.auth.adminDeleteUser(userId);
          this.showToast('User Deleted', `User @${username} removed from system.`, 'info');
          this.renderAdminPanel();
          this.renderTasks();
          this.renderMetrics();
        } catch (err) {
          alert(err.message);
        }
      }
    });

    // Admin Filter by User Select in Tasks Tab
    const filterUserSelect = document.getElementById('adminFilterByUserSelect');
    if (filterUserSelect) {
      filterUserSelect.addEventListener('change', () => {
        this.renderAdminTasksTable();
      });
    }

    // Admin Tasks Table Actions (Delete Task)
    document.getElementById('adminTasksTableBody').addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-admin-delete-task');
      if (!btn) return;

      const taskId = btn.getAttribute('data-task-id');
      if (confirm('Delete this task?')) {
        await this.tasks.deleteTask(taskId);
        this.showToast('Task Deleted', 'Task removed by Admin.', 'info');
        this.renderAdminTasksTable();
        this.renderTasks();
        this.renderMetrics();
      }
    });
  }
}
