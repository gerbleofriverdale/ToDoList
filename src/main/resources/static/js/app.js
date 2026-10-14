/**
 * FocusFlow Application Bootstrap
 * Initializes core services, registers subscriptions, and triggers initial UI render.
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize persistent storage & default seed accounts
  StorageService.init();

  // 2. Instantiate core domain services
  const authManager = new AuthManager();
  const taskManager = new TaskManager(authManager);
  const notificationService = new NotificationService();
  const motivationalEngine = new MotivationalEngine(document.getElementById('confettiCanvas'));

  // 3. Instantiate UI controller
  const uiManager = new UIManager(authManager, taskManager, notificationService, motivationalEngine);

  // 4. Hook reactive subscriptions
  authManager.subscribe(() => {
    uiManager.renderHeaderUser();
    uiManager.renderMetrics();
    uiManager.renderTasks();
  });

  taskManager.subscribe(() => {
    uiManager.renderMetrics();
  });

  // 5. Start background watcher for task due reminders
  notificationService.startReminderWatcher(taskManager);

  // 6. Initial render
  uiManager.renderHeaderUser();
  uiManager.renderMetrics();
  uiManager.renderTasks();

  // 7. Background sync with Spring Boot backend
  taskManager.syncWithBackend().then(() => {
    uiManager.renderMetrics();
    uiManager.renderTasks();
  });

  console.log('FocusFlow Task Management initialized successfully.');
});
