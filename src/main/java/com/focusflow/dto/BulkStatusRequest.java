package com.focusflow.dto;

import java.util.List;

public class BulkStatusRequest {
    private List<Long> taskIds;
    private String status;

    public BulkStatusRequest() {}

    public List<Long> getTaskIds() {
        return taskIds;
    }

    public void setTaskIds(List<Long> taskIds) {
        this.taskIds = taskIds;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
