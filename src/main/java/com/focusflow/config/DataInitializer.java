package com.focusflow.config;

import com.focusflow.model.Task;
import com.focusflow.model.User;
import com.focusflow.repository.TaskRepository;
import com.focusflow.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final TaskRepository taskRepository;

    public DataInitializer(UserRepository userRepository, TaskRepository taskRepository) {
        this.userRepository = userRepository;
        this.taskRepository = taskRepository;
    }

    @Override
    public void run(String... args) {
        if (userRepository.count() == 0) {
            // Seed Admin User
            User admin = new User("admin", "admin123", "System Admin", "admin");
            userRepository.save(admin);

            // Seed Regular Demo User
            User demo = new User("demo", "demo123", "Alex Rivera", "user");
            User savedDemo = userRepository.save(demo);

            // Seed Sample Tasks for Demo User
            Task task1 = new Task(savedDemo.getId(), "Design high-converting landing page", "Create responsive UI mockups and review with team", "high");
            task1.setStatus("running");
            task1.setStartedAt(System.currentTimeMillis() - 1000 * 60 * 18);
            task1.setElapsedSeconds(1080L);
            task1.setReminderTime(LocalDateTime.now().plusHours(2).toString().substring(0, 16));

            Task task2 = new Task(savedDemo.getId(), "Review pull request for auth integration", "Verify token validation and session persistence edge cases", "medium");
            task2.setStatus("paused");
            task2.setElapsedSeconds(720L);

            Task task3 = new Task(savedDemo.getId(), "Weekly sprint planning presentation", "Outline key milestones for the upcoming two-week sprint cycle", "low");
            task3.setStatus("completed");
            task3.setElapsedSeconds(2400L);
            task3.setCompletedAt(LocalDateTime.now().minusHours(3));

            Task task4 = new Task(savedDemo.getId(), "Set up Windows notification permissions", "Test Web Notification API native desktop alerts", "high");
            task4.setStatus("not-started");

            Task taskAdmin = new Task(admin.getId(), "Audit system users and permissions", "Ensure role separation and security integrity across tenant spaces", "high");
            taskAdmin.setStatus("not-started");

            taskRepository.save(task1);
            taskRepository.save(task2);
            taskRepository.save(task3);
            taskRepository.save(task4);
            taskRepository.save(taskAdmin);

            System.out.println(">>> Initialized FocusFlow demo data: Admin (admin/admin123) and Demo (demo/demo123)");
        }
    }
}
