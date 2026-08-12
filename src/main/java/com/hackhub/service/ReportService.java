package com.hackhub.service;

import com.hackhub.dto.AuthDtos.ApiResponse;
import com.hackhub.dto.ReportDto.*;
import com.hackhub.entity.Event;
import com.hackhub.entity.Report;
import com.hackhub.entity.User;
import com.hackhub.repository.EventRepository;
import com.hackhub.repository.ReportRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ReportService {

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private EventRepository eventRepository;

    @Transactional
    public ApiResponse reportEvent(Long eventId, CreateReportRequest request, User reporter) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("Event not found with ID: " + eventId));

        if (request.getReason() == null || request.getReason().trim().isEmpty()) {
            throw new IllegalArgumentException("Report reason is required.");
        }

        if (reportRepository.existsByEventAndReportedBy(event, reporter)) {
            throw new IllegalStateException("You have already reported this event.");
        }

        Report report = new Report();
        report.setEvent(event);
        report.setReportedBy(reporter);
        report.setReason(request.getReason().trim());
        report.setDescription(request.getDescription());
        report.setStatus("PENDING");

        reportRepository.save(report);
        return new ApiResponse(true, "Thank you. Your report has been submitted to department admins for review.");
    }

    public List<ReportResponse> getAllReports() {
        List<Report> reports = reportRepository.findByOrderByCreatedAtDesc();
        return reports.stream().map(this::mapToReportResponse).collect(Collectors.toList());
    }

    @Transactional
    public ApiResponse updateReportStatus(Long reportId, String status) {
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new IllegalArgumentException("Report not found with ID: " + reportId));

        if (!"RESOLVED".equalsIgnoreCase(status) && !"DISMISSED".equalsIgnoreCase(status)) {
            throw new IllegalArgumentException("Status must be RESOLVED or DISMISSED.");
        }

        report.setStatus(status.toUpperCase());
        reportRepository.save(report);

        return new ApiResponse(true, "Report marked as " + status.toUpperCase());
    }

    private ReportResponse mapToReportResponse(Report report) {
        ReportResponse response = new ReportResponse();
        response.setId(report.getId());
        response.setEventId(report.getEvent().getId());
        response.setEventTitle(report.getEvent().getTitle());
        response.setReportedByRegNo(report.getReportedBy().getRegistrationNumber());
        response.setReportedByName(report.getReportedBy().getName());
        response.setReason(report.getReason());
        response.setDescription(report.getDescription());
        response.setStatus(report.getStatus());
        response.setCreatedAt(report.getCreatedAt());
        return response;
    }
}
