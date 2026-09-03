package com.hackhub.service;

import com.hackhub.entity.ActivityLog;
import com.hackhub.entity.User;
import com.hackhub.repository.ActivityLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ActivityLogService {

    private static final Logger logger = LoggerFactory.getLogger(ActivityLogService.class);

    @Autowired
    private ActivityLogRepository activityLogRepository;

    @Transactional
    public void log(String userRegNo, String userName, String userRole, String action, String details, String ipAddress) {
        try {
            ActivityLog log = new ActivityLog(
                    userRegNo != null ? userRegNo : "SYSTEM",
                    userName != null ? userName : "System",
                    userRole != null ? userRole : "SYSTEM",
                    action != null ? action.toUpperCase() : "GENERAL",
                    details != null ? details : "",
                    ipAddress
            );
            activityLogRepository.save(log);
            logger.info("📝 [24/7 AUDIT LOG] [{}] [{}] {}: {}", action, userRole, userRegNo, details);
        } catch (Exception e) {
            logger.error("Failed to save activity log: {}", e.getMessage());
        }
    }

    public void logUserAction(User user, String action, String details) {
        if (user != null) {
            log(user.getRegistrationNumber(), user.getName(), user.getRole(), action, details, null);
        } else {
            log("ANONYMOUS", "Anonymous", "GUEST", action, details, null);
        }
    }

    public List<ActivityLog> getLogs(String search, String action) {
        if (search != null && !search.trim().isEmpty()) {
            String q = search.trim();
            return activityLogRepository.findByUserRegNoContainingIgnoreCaseOrDetailsContainingIgnoreCaseOrActionContainingIgnoreCaseOrderByCreatedAtDesc(
                    q, q, q);
        }
        if (action != null && !action.trim().isEmpty() && !"ALL".equalsIgnoreCase(action.trim())) {
            return activityLogRepository.findByActionOrderByCreatedAtDesc(action.trim().toUpperCase());
        }
        return activityLogRepository.findTop500ByOrderByCreatedAtDesc();
    }

    public long getTotalLogsCount() {
        return activityLogRepository.count();
    }

    @Transactional
    public void clearLogs() {
        activityLogRepository.deleteAll();
        log("SYSTEM", "System Admin", "ROLE_ADMIN", "LOGS_CLEARED", "All activity logs were purged by administrator.", null);
    }
}
