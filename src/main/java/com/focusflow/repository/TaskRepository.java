package com.focusflow.repository;

import com.focusflow.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByUserIdOrderByIdDesc(Long userId);
    List<Task> findAllByOrderByIdDesc();
    void deleteByUserId(Long userId);
}
