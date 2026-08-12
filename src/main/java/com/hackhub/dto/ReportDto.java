package com.hackhub.dto;

import java.time.LocalDateTime;

public class ReportDto {

    public static class CreateReportRequest {
        private String reason;
        private String description;

        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }

    public static class ReportResponse {
        private Long id;
        private Long eventId;
        private String eventTitle;
        private String reportedByRegNo;
        private String reportedByName;
        private String reason;
        private String description;
        private String status;
        private LocalDateTime createdAt;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public Long getEventId() { return eventId; }
        public void setEventId(Long eventId) { this.eventId = eventId; }
        public String getEventTitle() { return eventTitle; }
        public void setEventTitle(String eventTitle) { this.eventTitle = eventTitle; }
        public String getReportedByRegNo() { return reportedByRegNo; }
        public void setReportedByRegNo(String reportedByRegNo) { this.reportedByRegNo = reportedByRegNo; }
        public String getReportedByName() { return reportedByName; }
        public void setReportedByName(String reportedByName) { this.reportedByName = reportedByName; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public LocalDateTime getCreatedAt() { return createdAt; }
        public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    }
}
