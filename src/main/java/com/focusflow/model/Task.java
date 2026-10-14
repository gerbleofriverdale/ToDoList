package com.focusflow.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(length = 1000)
    private String description;

    @Column(nullable = false, length = 20)
    private String priority = "medium"; // "high", "medium", "low"

    @Column(nullable = false, length = 30)
    private String status = "not-started"; // "not-started", "running", "paused", "completed"

    private Long startedAt; // Unix timestamp in ms when current run started

    @Column(nullable = false)
    private Long elapsedSeconds = 0L;

    @Column(length = 50)
    private String reminderTime;

    private Boolean reminderTriggered = false;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime completedAt;

    public Task() {
        this.createdAt = LocalDateTime.now();
    }

    public Task(Long userId, String title, String description, String priority) {
        this.userId = userId;
        this.title = title;
        this.description = description;
        this.priority = priority != null ? priority : "medium";
        this.status = "not-started";
        this.elapsedSeconds = 0L;
        this.reminderTriggered = false;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Long getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Long startedAt) {
        this.startedAt = startedAt;
    }

    public Long getElapsedSeconds() {
        return elapsedSeconds;
    }

    public void setElapsedSeconds(Long elapsedSeconds) {
        this.elapsedSeconds = elapsedSeconds;
    }

    public String getReminderTime() {
        return reminderTime;
    }

    public void setReminderTime(String reminderTime) {
        this.reminderTime = reminderTime;
    }

    public Boolean getReminderTriggered() {
        return reminderTriggered;
    }

    public void setReminderTriggered(Boolean reminderTriggered) {
        this.reminderTriggered = reminderTriggered;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }
}
