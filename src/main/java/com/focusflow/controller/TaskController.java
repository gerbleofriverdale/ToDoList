package com.focusflow.controller;

import com.focusflow.dto.BulkDeleteRequest;
import com.focusflow.dto.BulkStatusRequest;
import com.focusflow.dto.BulkTaskRequest;
import com.focusflow.dto.TaskRequest;
import com.focusflow.model.Task;
import com.focusflow.service.TaskService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    private Long parseUserId(String userIdStr) {
        if (userIdStr == null || userIdStr.isBlank() || "usr_demo".equalsIgnoreCase(userIdStr)) {
            return 2L;
        }
        if ("usr_admin".equalsIgnoreCase(userIdStr)) {
            return 1L;
        }
        try {
            return Long.parseLong(userIdStr.replaceAll("[^0-9]", ""));
        } catch (Exception e) {
            return 2L;
        }
    }

    @GetMapping
    public ResponseEntity<List<Task>> getTasks(
            @RequestHeader(value = "X-User-Id", defaultValue = "2") String userIdStr,
            @RequestHeader(value = "X-User-Role", defaultValue = "user") String role) {
        Long userId = parseUserId(userIdStr);
        return ResponseEntity.ok(taskService.getTasksByUser(userId));
    }

    @PostMapping
    public ResponseEntity<?> createTask(
            @RequestBody TaskRequest req,
            @RequestHeader(value = "X-User-Id", defaultValue = "2") String userIdStr,
            @RequestHeader(value = "X-User-Role", defaultValue = "user") String role) {
        try {
            Long userId = parseUserId(userIdStr);
            boolean isAdmin = "admin".equalsIgnoreCase(role);
            Task task = taskService.createTask(req, userId, isAdmin);
            return ResponseEntity.status(HttpStatus.CREATED).body(task);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/bulk")
    public ResponseEntity<?> bulkCreateTasks(
            @RequestBody BulkTaskRequest req,
            @RequestHeader(value = "X-User-Id", defaultValue = "2") String userIdStr,
            @RequestHeader(value = "X-User-Role", defaultValue = "user") String role) {
        try {
            Long userId = parseUserId(userIdStr);
            boolean isAdmin = "admin".equalsIgnoreCase(role);
            List<Task> created = taskService.bulkCreateTasks(req, userId, isAdmin);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<?> startTask(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", defaultValue = "2") String userIdStr,
            @RequestHeader(value = "X-User-Role", defaultValue = "user") String role) {
        try {
            Long userId = parseUserId(userIdStr);
            boolean isAdmin = "admin".equalsIgnoreCase(role);
            Task task = taskService.startTask(id, userId, isAdmin);
            return ResponseEntity.ok(task);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/pause")
    public ResponseEntity<?> pauseTask(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", defaultValue = "2") String userIdStr,
            @RequestHeader(value = "X-User-Role", defaultValue = "user") String role) {
        try {
            Long userId = parseUserId(userIdStr);
            boolean isAdmin = "admin".equalsIgnoreCase(role);
            Task task = taskService.pauseTask(id, userId, isAdmin);
            return ResponseEntity.ok(task);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/end")
    public ResponseEntity<?> endTask(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", defaultValue = "2") String userIdStr,
            @RequestHeader(value = "X-User-Role", defaultValue = "user") String role) {
        try {
            Long userId = parseUserId(userIdStr);
            boolean isAdmin = "admin".equalsIgnoreCase(role);
            Task task = taskService.endTask(id, userId, isAdmin);
            return ResponseEntity.ok(task);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/bulk-status")
    public ResponseEntity<?> bulkUpdateStatus(
            @RequestBody BulkStatusRequest req,
            @RequestHeader(value = "X-User-Id", defaultValue = "2") String userIdStr,
            @RequestHeader(value = "X-User-Role", defaultValue = "user") String role) {
        Long userId = parseUserId(userIdStr);
        boolean isAdmin = "admin".equalsIgnoreCase(role);
        int updated = taskService.bulkUpdateStatus(req, userId, isAdmin);
        return ResponseEntity.ok(Map.of("updatedCount", updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTask(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", defaultValue = "2") String userIdStr,
            @RequestHeader(value = "X-User-Role", defaultValue = "user") String role) {
        try {
            Long userId = parseUserId(userIdStr);
            boolean isAdmin = "admin".equalsIgnoreCase(role);
            taskService.deleteTask(id, userId, isAdmin);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/bulk-delete")
    public ResponseEntity<?> bulkDeleteTasks(
            @RequestBody BulkDeleteRequest req,
            @RequestHeader(value = "X-User-Id", defaultValue = "2") String userIdStr,
            @RequestHeader(value = "X-User-Role", defaultValue = "user") String role) {
        Long userId = parseUserId(userIdStr);
        boolean isAdmin = "admin".equalsIgnoreCase(role);
        int deleted = taskService.bulkDeleteTasks(req, userId, isAdmin);
        return ResponseEntity.ok(Map.of("deletedCount", deleted));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(
            @RequestHeader(value = "X-User-Id", defaultValue = "2") String userIdStr) {
        Long userId = parseUserId(userIdStr);
        return ResponseEntity.ok(taskService.getStats(userId));
    }
}
