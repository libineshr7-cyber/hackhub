package com.hackhub.repository;

import com.hackhub.entity.Event;
import com.hackhub.entity.Report;
import com.hackhub.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReportRepository extends JpaRepository<Report, Long> {
    List<Report> findByOrderByCreatedAtDesc();
    List<Report> findByStatusOrderByCreatedAtDesc(String status);
    boolean existsByEventAndReportedBy(Event event, User reportedBy);
    void deleteByEvent(Event event);
    long countByStatus(String status);
}
