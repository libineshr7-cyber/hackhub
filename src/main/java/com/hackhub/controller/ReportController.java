package com.hackhub.controller;

import com.hackhub.dto.AuthDtos.ApiResponse;
import com.hackhub.dto.ReportDto.CreateReportRequest;
import com.hackhub.entity.User;
import com.hackhub.repository.UserRepository;
import com.hackhub.service.ReportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/events")
public class ReportController {

    @Autowired
    private ReportService reportService;

    @Autowired
    private UserRepository userRepository;

    private User getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("Authentication required.");
        }
        return userRepository.findByRegistrationNumber(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + authentication.getName()));
    }

    @PostMapping("/{id}/report")
    public ResponseEntity<?> reportEvent(@PathVariable("id") Long eventId, @RequestBody CreateReportRequest request, Authentication authentication) {
        try {
            User currentUser = getCurrentUser(authentication);
            ApiResponse response = reportService.reportEvent(eventId, request, currentUser);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }
}
