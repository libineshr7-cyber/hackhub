package com.hackhub.controller;

import com.hackhub.dto.AdminUserDto.*;
import com.hackhub.dto.AuthDtos.ApiResponse;
import com.hackhub.dto.ReportDto.ReportResponse;
import com.hackhub.service.AdminService;
import com.hackhub.service.ReportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
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

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardStats> getDashboardStats() {
        return ResponseEntity.ok(adminService.getDashboardStats());
    }

    @GetMapping("/students")
    public ResponseEntity<List<UserResponse>> getStudents(@RequestParam(value = "search", required = false) String search) {
        return ResponseEntity.ok(adminService.getStudents(search));
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
}
