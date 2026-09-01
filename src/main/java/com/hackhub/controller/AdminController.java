package com.hackhub.controller;

import com.hackhub.dto.AdminUserDto.*;
import com.hackhub.dto.AuthDtos.ApiResponse;
import com.hackhub.dto.ReportDto.ReportResponse;
import com.hackhub.entity.User;
import com.hackhub.repository.UserRepository;
import com.hackhub.service.AdminService;
import com.hackhub.service.ReportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @Autowired
    private ReportService reportService;

    @Autowired
    private com.hackhub.service.EventService eventService;

    @Autowired
    private UserRepository userRepository;

    private User getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("Authentication required.");
        }
        return userRepository.findByRegistrationNumber(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + authentication.getName()));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardStats> getDashboardStats() {
        return ResponseEntity.ok(adminService.getDashboardStats());
    }

    @GetMapping("/students")
    public ResponseEntity<List<UserResponse>> getStudents(
            @RequestParam(value = "search", required = false) String search,
            Authentication authentication) {
        User caller = getCurrentUser(authentication);
        return ResponseEntity.ok(adminService.getStudents(search, caller.getRole(), caller.getDepartment()));
    }

    @GetMapping("/users/log")
    public ResponseEntity<List<UserResponse>> getUsersLog(@RequestParam(value = "search", required = false) String search) {
        return ResponseEntity.ok(adminService.getAllUserLogs(search));
    }

    @PostMapping("/students/create")
    public ResponseEntity<?> createStudent(@RequestBody CreateStudentRequest request) {
        try {
            UserResponse response = adminService.createStudent(request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @PutMapping("/students/{id}/status")
    public ResponseEntity<?> updateStudentStatus(@PathVariable("id") Long id, @RequestBody UpdateUserStatusRequest request) {
        try {
            ApiResponse response = adminService.updateStudentStatus(id, request.getStatus());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @PostMapping("/students/{id}/reset-password")
    public ResponseEntity<?> resetStudentPassword(@PathVariable("id") Long id) {
        try {
            ApiResponse response = adminService.resetStudentPassword(id);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    // =====================================================================
    // SUB-ADMIN MANAGEMENT — ROLE_ADMIN only
    // =====================================================================

    @GetMapping("/subadmins")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<List<UserResponse>> getSubAdmins() {
        return ResponseEntity.ok(adminService.getSubAdmins());
    }

    @PostMapping("/subadmins/create")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<?> createSubAdmin(@RequestBody CreateSubAdminRequest request) {
        try {
            UserResponse response = adminService.createSubAdmin(request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @PutMapping("/subadmins/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<?> updateSubAdmin(@PathVariable("id") Long id, @RequestBody UpdateSubAdminRequest request) {
        try {
            ApiResponse response = adminService.updateSubAdmin(id, request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @PutMapping("/subadmins/{id}/status")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<?> updateSubAdminStatus(@PathVariable("id") Long id, @RequestBody UpdateUserStatusRequest request) {
        try {
            ApiResponse response = adminService.updateSubAdminStatus(id, request.getStatus());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @PostMapping("/subadmins/{id}/reset-password")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<?> resetSubAdminPassword(@PathVariable("id") Long id) {
        try {
            ApiResponse response = adminService.resetSubAdminPassword(id);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    // =====================================================================
    // REPORTS
    // =====================================================================

    @GetMapping("/reports")
    public ResponseEntity<List<ReportResponse>> getReports() {
        return ResponseEntity.ok(reportService.getAllReports());
    }

    @PutMapping("/reports/{id}/status")
    public ResponseEntity<?> updateReportStatus(@PathVariable("id") Long id, @RequestBody Map<String, String> body) {
        try {
            String status = body.get("status");
            ApiResponse response = reportService.updateReportStatus(id, status);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    // =====================================================================
    // EVENTS
    // =====================================================================

    @GetMapping("/events")
    public ResponseEntity<List<com.hackhub.dto.EventDto>> getAllEvents() {
        return ResponseEntity.ok(eventService.getAllEventsForCalendar(null));
    }

    @PutMapping("/events/{id}")
    public ResponseEntity<?> updateEvent(
            @PathVariable("id") Long id,
            @RequestPart("event") com.hackhub.dto.EventDto dto,
            @RequestPart(value = "posterFile", required = false) org.springframework.web.multipart.MultipartFile posterFile) {
        try {
            com.hackhub.dto.EventDto updated = eventService.updateEvent(id, dto, posterFile);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @DeleteMapping("/events/{id}")
    public ResponseEntity<?> deleteEvent(@PathVariable("id") Long id) {
        try {
            eventService.deleteEvent(id);
            return ResponseEntity.ok(new ApiResponse(true, "Event deleted successfully."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }
}
