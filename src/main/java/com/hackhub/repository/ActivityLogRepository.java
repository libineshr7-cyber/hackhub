package com.hackhub.repository;

import com.hackhub.entity.ActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {
    List<ActivityLog> findTop500ByOrderByCreatedAtDesc();
    List<ActivityLog> findByActionOrderByCreatedAtDesc(String action);
    List<ActivityLog> findByUserRegNoContainingIgnoreCaseOrDetailsContainingIgnoreCaseOrActionContainingIgnoreCaseOrderByCreatedAtDesc(
            String regNo, String details, String action);
}
