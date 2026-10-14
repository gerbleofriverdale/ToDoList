/**
 * NotificationService - Interfaces with Web Notification API to send native
 * Windows desktop notifications, manages permissions, and schedules reminder checks.
 */
class NotificationService {
  constructor() {
    this.audioCtx = null;
    this.intervalId = null;
    this.onToastCallback = null;
    const stored = localStorage.getItem('focusflow_alerts_enabled');
    this.enabled = stored === null ? true : stored === 'true';
  }

  setToastHandler(callback) {
    this.onToastCallback = callback;
  }

  isSupported() {
    return 'Notification' in window;
  }

  getPermission() {
    return this.isSupported() ? Notification.permission : 'unsupported';
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('focusflow_alerts_enabled', String(this.enabled));
    return this.enabled;
  }

  isEnabled() {
    return this.enabled && this.isSupported() && Notification.permission === 'granted';
  }

  async requestPermission() {
    if (!this.isSupported()) {
      if (this.onToastCallback) {
        this.onToastCallback('Notifications Unsupported', 'Your browser does not support desktop notifications.', 'warning');
      }
      return 'unsupported';
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.send(
          '🔔 Notifications Enabled!',
          { body: 'FocusFlow will now alert you directly in Windows for task updates and reminders.' }
        );
      }
      return permission;
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      return 'denied';
    }
  }

  /**
   * Plays a subtle, pleasant audio chime using browser Web Audio API.
   * type: 'chime' (reminder), 'celebrate' (fanfare), 'pause' (gentle tone)
   */
  playChime(type = 'chime') {
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      if (type === 'celebrate') {
        // High upbeat celebratory 3-note arpeggio (C5 -> E5 -> G5)
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          gain.gain.setValueAtTime(0.18, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.35);
        });
      } else if (type === 'pause') {
        // Gentle downward two-tone
        [659.25, 523.25].forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.14);
          gain.gain.setValueAtTime(0.12, now + idx * 0.14);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.3);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now + idx * 0.14);
          osc.stop(now + idx * 0.14 + 0.3);
        });
      } else {
        // Standard single gentle bell
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); // A5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (e) {
      // Audio autoplay policies might defer sound until user gesture
      console.warn('Audio chime deferred:', e);
    }
  }

  /**
   * Sends a Windows Desktop notification if granted, and always informs UI toast.
   */
  send(title, options = {}) {
    if (this.enabled) {
      this.playChime(options.sound || 'chime');
    }

    // Always mirror to in-app toast
    if (this.onToastCallback) {
      this.onToastCallback(title, options.body || '', options.toastType || 'info');
    }

    if (this.enabled && this.isSupported() && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body: options.body || '',
          icon: options.icon || 'https://cdn-icons-png.flaticon.com/512/906/906334.png',
          badge: options.badge || 'https://cdn-icons-png.flaticon.com/512/906/906334.png',
          tag: options.tag || 'focusflow-notification',
          renotify: true
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (err) {
        console.warn('Windows native notification failed, falling back to UI toast:', err);
      }
    }
  }

  /**
   * Start periodic scanner checking for task reminder timestamps.
   */
  startReminderWatcher(taskManager) {
    if (this.intervalId) clearInterval(this.intervalId);

    this.intervalId = setInterval(() => {
      if (!this.enabled) return;
      const allTasks = StorageService.getTasks();
      const now = new Date();
      let hasChanges = false;

      allTasks.forEach(task => {
        if (task.reminderTime && !task.reminderTriggered && task.status !== 'completed') {
          const reminderDate = new Date(task.reminderTime);
          if (reminderDate <= now) {
            task.reminderTriggered = true;
            hasChanges = true;

            this.send(`⏰ Reminder: ${task.title}`, {
              body: task.description || 'It is time to make progress on this scheduled task!',
              toastType: 'reminder',
              sound: 'chime'
            });
          }
        }
      });

      if (hasChanges) {
        StorageService.saveTasks(allTasks);
        taskManager.notify();
      }
    }, 10000); // Check every 10 seconds
  }
}
