package com.focusflow.service;

import com.focusflow.model.User;
import com.focusflow.repository.TaskRepository;
import com.focusflow.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final TaskRepository taskRepository;

    public UserService(UserRepository userRepository, TaskRepository taskRepository) {
        this.userRepository = userRepository;
        this.taskRepository = taskRepository;
    }

    public Optional<User> authenticate(String username, String password) {
        if (username == null || password == null) return Optional.empty();
        return userRepository.findByUsername(username.trim().toLowerCase())
                .filter(u -> u.getPassword().equals(password));
    }

    public User register(String username, String password, String name, String role) {
        String cleanUsername = username.trim().toLowerCase();
        if (cleanUsername.length() < 3) {
            throw new IllegalArgumentException("Username must be at least 3 characters.");
        }
        if (password == null || password.length() < 4) {
            throw new IllegalArgumentException("Password must be at least 4 characters.");
        }
        if (userRepository.existsByUsername(cleanUsername)) {
            throw new IllegalArgumentException("Username is already taken.");
        }

        String assignedRole = ("admin".equalsIgnoreCase(role)) ? "admin" : "user";
        String displayName = (name != null && !name.trim().isEmpty()) ? name.trim() : cleanUsername;

        User user = new User(cleanUsername, password, displayName, assignedRole);
        return userRepository.save(user);
    }

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public Optional<User> findById(Long id) {
        return userRepository.findById(id);
    }

    @Transactional
    public void deleteUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found."));

        if ("admin".equalsIgnoreCase(user.getUsername())) {
            throw new IllegalArgumentException("Cannot delete the root System Admin account.");
        }

        // Cascade delete tasks
        taskRepository.deleteByUserId(userId);
        userRepository.deleteById(userId);
    }
}
