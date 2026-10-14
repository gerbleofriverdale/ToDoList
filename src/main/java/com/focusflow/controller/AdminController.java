package com.focusflow.controller;

import com.focusflow.dto.RegisterRequest;
import com.focusflow.model.Task;
import com.focusflow.model.User;
import com.focusflow.service.TaskService;
import com.focusflow.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserService userService;
    private final TaskService taskService;

    public AdminController(UserService userService, TaskService taskService) {
        this.userService = userService;
        this.taskService = taskService;
    }

    private boolean checkAdmin(String role) {
        return "admin".equalsIgnoreCase(role);
    }

    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers(@RequestHeader(value = "X-User-Role", defaultValue = "user") String role) {
        if (!checkAdmin(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access required."));
        }
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @PostMapping("/users")
    public ResponseEntity<?> createUser(
            @RequestBody RegisterRequest req,
            @RequestParam(defaultValue = "user") String targetRole,
            @RequestHeader(value = "X-User-Role", defaultValue = "user") String role) {
        if (!checkAdmin(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access required."));
        }

        try {
            User created = userService.register(req.getUsername(), req.getPassword(), req.getName(), targetRole);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Role", defaultValue = "user") String role) {
        if (!checkAdmin(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access required."));
        }

        try {
            userService.deleteUser(id);
            return ResponseEntity.ok(Map.of("success", true, "message", "User and all associated tasks deleted."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/tasks")
    public ResponseEntity<?> getAllTasks(
            @RequestParam(required = false) Long userId,
            @RequestHeader(value = "X-User-Role", defaultValue = "user") String role) {
        if (!checkAdmin(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access required."));
        }

        if (userId != null) {
            return ResponseEntity.ok(taskService.getTasksByUser(userId));
        }
        return ResponseEntity.ok(taskService.getAllTasks());
    }

    @DeleteMapping("/tasks/{id}")
    public ResponseEntity<?> deleteTask(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Role", defaultValue = "user") String role) {
        if (!checkAdmin(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access required."));
        }

        try {
            taskService.deleteTask(id, null, true);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
