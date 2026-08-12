package com.hackhub.dto;

public class AdminUserDto {

    public static class CreateStudentRequest {
        private String registrationNumber;
        private String name;
        private String email;
        private String skills;

        public String getRegistrationNumber() { return registrationNumber; }
        public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getSkills() { return skills; }
        public void setSkills(String skills) { this.skills = skills; }
    }

    public static class UpdateUserStatusRequest {
        private String status; // ACTIVE, DISABLED

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }

    public static class UserResponse {
        private Long id;
        private String registrationNumber;
        private String name;
        private String email;
        private String role;
        private String skills;
        private String status;
        private boolean firstLogin;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getRegistrationNumber() { return registrationNumber; }
        public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
        public String getSkills() { return skills; }
        public void setSkills(String skills) { this.skills = skills; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public boolean isFirstLogin() { return firstLogin; }
        public void setFirstLogin(boolean firstLogin) { this.firstLogin = firstLogin; }
    }

    public static class DashboardStats {
        private long totalStudents;
        private long totalEvents;
        private long upcomingEvents;
        private long endedEvents;
        private long totalSavedEvents;
        private long totalReports;
        private long pendingReports;

        public long getTotalStudents() { return totalStudents; }
        public void setTotalStudents(long totalStudents) { this.totalStudents = totalStudents; }
        public long getTotalEvents() { return totalEvents; }
        public void setTotalEvents(long totalEvents) { this.totalEvents = totalEvents; }
        public long getUpcomingEvents() { return upcomingEvents; }
        public void setUpcomingEvents(long upcomingEvents) { this.upcomingEvents = upcomingEvents; }
        public long getEndedEvents() { return endedEvents; }
        public void setEndedEvents(long endedEvents) { this.endedEvents = endedEvents; }
        public long getTotalSavedEvents() { return totalSavedEvents; }
        public void setTotalSavedEvents(long totalSavedEvents) { this.totalSavedEvents = totalSavedEvents; }
        public long getTotalReports() { return totalReports; }
        public void setTotalReports(long totalReports) { this.totalReports = totalReports; }
        public long getPendingReports() { return pendingReports; }
        public void setPendingReports(long pendingReports) { this.pendingReports = pendingReports; }
    }
}
