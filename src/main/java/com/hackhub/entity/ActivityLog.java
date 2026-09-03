package com.hackhub.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "activity_logs")
public class ActivityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "user_reg_no", nullable = false)
    private String userRegNo;

    @Column(name = "user_name")
    private String userName;

    @Column(name = "user_role", nullable = false)
    private String userRole;

    @Column(nullable = false)
    private String action;

    @Column(length = 2000, nullable = false)
    private String details;

    @Column(name = "ip_address")
    private String ipAddress;

    public ActivityLog() {}

    public ActivityLog(String userRegNo, String userName, String userRole, String action, String details, String ipAddress) {
        this.createdAt = LocalDateTime.now();
        this.userRegNo = userRegNo;
        this.userName = userName;
        this.userRole = userRole;
        this.action = action;
        this.details = details;
        this.ipAddress = ipAddress;
    }

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public String getUserRegNo() { return userRegNo; }
    public void setUserRegNo(String userRegNo) { this.userRegNo = userRegNo; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public String getUserRole() { return userRole; }
    public void setUserRole(String userRole) { this.userRole = userRole; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
}
