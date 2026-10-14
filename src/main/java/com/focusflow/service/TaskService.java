package com.focusflow.service;

import com.focusflow.dto.BulkDeleteRequest;
import com.focusflow.dto.BulkStatusRequest;
import com.focusflow.dto.BulkTaskRequest;
import com.focusflow.dto.TaskRequest;
import com.focusflow.model.Task;
import com.focusflow.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class TaskService {

    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    public List<Task> getTasksByUser(Long userId) {
        return taskRepository.findByUserIdOrderByIdDesc(userId);
    }

    public List<Task> getAllTasks() {
        return taskRepository.findAllByOrderByIdDesc();
    }

    public Optional<Task> getTaskById(Long id) {
        return taskRepository.findById(id);
    }

    @Transactional
    public Task createTask(TaskRequest req, Long currentUserId, boolean isAdmin) {
        if (req.getTitle() == null || req.getTitle().trim().isEmpty()) {
            throw new IllegalArgumentException("Task title is required.");
        }

        Long targetUserId = (isAdmin && req.getUserId() != null) ? req.getUserId() : currentUserId;
        Task task = new Task(targetUserId, req.getTitle().trim(), req.getDescription(), req.getPriority());
        task.setReminderTime(req.getReminderTime());

        return taskRepository.save(task);
    }

    @Transactional
    public List<Task> bulkCreateTasks(BulkTaskRequest req, Long currentUserId, boolean isAdmin) {
        if (req.getLines() == null || req.getLines().isEmpty()) {
            throw new IllegalArgumentException("No tasks provided.");
        }

        Long targetUserId = (isAdmin && req.getUserId() != null) ? req.getUserId() : currentUserId;
        List<Task> createdTasks = new ArrayList<>();
        Pattern priorityPattern = Pattern.compile("^\\[(h|high|m|medium|l|low)\\]\\s*(.+)$", Pattern.CASE_INSENSITIVE);

        for (String rawLine : req.getLines()) {
            String line = rawLine != null ? rawLine.trim() : "";
            if (line.isEmpty()) continue;

            String priority = req.getDefaultPriority() != null ? req.getDefaultPriority() : "medium";
            String title = line;

            Matcher matcher = priorityPattern.matcher(line);
            if (matcher.matches()) {
                String p = matcher.group(1).toLowerCase();
                if (p.startsWith("h")) priority = "high";
                else if (p.startsWith("m")) priority = "medium";
                else if (p.startsWith("l")) priority = "low";
                title = matcher.group(2).trim();
            }

            Task task = new Task(targetUserId, title, "", priority);
            task.setReminderTime(req.getReminderTime());
            createdTasks.add(task);
        }

        return taskRepository.saveAll(createdTasks);
    }

    @Transactional
    public Task startTask(Long taskId, Long currentUserId, boolean isAdmin) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found."));

        verifyOwnership(task, currentUserId, isAdmin);

        task.setStatus("running");
        task.setStartedAt(System.currentTimeMillis());
        return taskRepository.save(task);
    }

    @Transactional
    public Task pauseTask(Long taskId, Long currentUserId, boolean isAdmin) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found."));

        verifyOwnership(task, currentUserId, isAdmin);

        if ("running".equalsIgnoreCase(task.getStatus()) && task.getStartedAt() != null) {
            long addSeconds = (System.currentTimeMillis() - task.getStartedAt()) / 1000;
            task.setElapsedSeconds((task.getElapsedSeconds() != null ? task.getElapsedSeconds() : 0L) + addSeconds);
        }

        task.setStatus("paused");
        task.setStartedAt(null);
        return taskRepository.save(task);
    }

    @Transactional
    public Task endTask(Long taskId, Long currentUserId, boolean isAdmin) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found."));

        verifyOwnership(task, currentUserId, isAdmin);

        if ("running".equalsIgnoreCase(task.getStatus()) && task.getStartedAt() != null) {
            long addSeconds = (System.currentTimeMillis() - task.getStartedAt()) / 1000;
            task.setElapsedSeconds((task.getElapsedSeconds() != null ? task.getElapsedSeconds() : 0L) + addSeconds);
        }

        task.setStatus("completed");
        task.setStartedAt(null);
        task.setCompletedAt(LocalDateTime.now());
        return taskRepository.save(task);
    }

    @Transactional
    public int bulkUpdateStatus(BulkStatusRequest req, Long currentUserId, boolean isAdmin) {
        if (req.getTaskIds() == null || req.getTaskIds().isEmpty() || req.getStatus() == null) {
            return 0;
        }

        List<Task> tasks = taskRepository.findAllById(req.getTaskIds());
        int updated = 0;
        String newStatus = req.getStatus().toLowerCase();

        for (Task task : tasks) {
            if (!isAdmin && !task.getUserId().equals(currentUserId)) {
                continue;
            }

            if ("running".equals(newStatus)) {
                task.setStatus("running");
                task.setStartedAt(System.currentTimeMillis());
                updated++;
            } else if ("paused".equals(newStatus)) {
                if ("running".equalsIgnoreCase(task.getStatus()) && task.getStartedAt() != null) {
                    long addSeconds = (System.currentTimeMillis() - task.getStartedAt()) / 1000;
                    task.setElapsedSeconds((task.getElapsedSeconds() != null ? task.getElapsedSeconds() : 0L) + addSeconds);
                }
                task.setStatus("paused");
                task.setStartedAt(null);
                updated++;
            } else if ("completed".equals(newStatus)) {
                if ("running".equalsIgnoreCase(task.getStatus()) && task.getStartedAt() != null) {
                    long addSeconds = (System.currentTimeMillis() - task.getStartedAt()) / 1000;
                    task.setElapsedSeconds((task.getElapsedSeconds() != null ? task.getElapsedSeconds() : 0L) + addSeconds);
                }
                task.setStatus("completed");
                task.setStartedAt(null);
                task.setCompletedAt(LocalDateTime.now());
                updated++;
            }
        }

        taskRepository.saveAll(tasks);
        return updated;
    }

    @Transactional
    public void deleteTask(Long taskId, Long currentUserId, boolean isAdmin) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found."));

        verifyOwnership(task, currentUserId, isAdmin);
        taskRepository.delete(task);
    }

    @Transactional
    public int bulkDeleteTasks(BulkDeleteRequest req, Long currentUserId, boolean isAdmin) {
        if (req.getTaskIds() == null || req.getTaskIds().isEmpty()) return 0;

        List<Task> tasks = taskRepository.findAllById(req.getTaskIds());
        List<Task> toDelete = new ArrayList<>();

        for (Task task : tasks) {
            if (isAdmin || task.getUserId().equals(currentUserId)) {
                toDelete.add(task);
            }
        }

        taskRepository.deleteAll(toDelete);
        return toDelete.size();
    }

    public Map<String, Long> getStats(Long userId) {
        List<Task> userTasks = taskRepository.findByUserIdOrderByIdDesc(userId);
        long total = userTasks.size();
        long running = userTasks.stream().filter(t -> "running".equalsIgnoreCase(t.getStatus())).count();
        long paused = userTasks.stream().filter(t -> "paused".equalsIgnoreCase(t.getStatus())).count();
        long completed = userTasks.stream().filter(t -> "completed".equalsIgnoreCase(t.getStatus())).count();

        Map<String, Long> stats = new HashMap<>();
        stats.put("total", total);
        stats.put("running", running);
        stats.put("paused", paused);
        stats.put("completed", completed);
        return stats;
    }

    private void verifyOwnership(Task task, Long currentUserId, boolean isAdmin) {
        if (!isAdmin && !task.getUserId().equals(currentUserId)) {
            throw new SecurityException("Access denied: You do not own this task.");
        }
    }
}
