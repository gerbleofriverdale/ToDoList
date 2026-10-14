package com.focusflow.dto;

import java.util.List;

public class BulkDeleteRequest {
    private List<Long> taskIds;

    public BulkDeleteRequest() {}

    public List<Long> getTaskIds() {
        return taskIds;
    }

    public void setTaskIds(List<Long> taskIds) {
        this.taskIds = taskIds;
    }
}
