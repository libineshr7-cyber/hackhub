package com.hackhub.controller;

import com.hackhub.dto.AuthDtos.ApiResponse;
import com.hackhub.dto.NotificationDto;
import com.hackhub.entity.User;
import com.hackhub.repository.UserRepository;
import com.hackhub.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private UserRepository userRepository;

    private User getAuthenticatedUser(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) return null;
        return userRepository.findByRegistrationNumber(auth.getName()).orElse(null);
    }

    @GetMapping
    public ResponseEntity<?> getNotifications(Authentication auth) {
        User user = getAuthenticatedUser(auth);
        if (user == null) return ResponseEntity.ok(Collections.emptyList());
        List<NotificationDto> list = notificationService.getUserNotifications(user);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> getUnreadCount(Authentication auth) {
        User user = getAuthenticatedUser(auth);
        long count = (user != null) ? notificationService.getUnreadCount(user) : 0;
        Map<String, Object> resp = new HashMap<>();
        resp.put("count", count);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/read-all")
    public ResponseEntity<?> markAllAsRead(Authentication auth) {
        User user = getAuthenticatedUser(auth);
        if (user != null) {
            notificationService.markAllAsRead(user);
        }
        return ResponseEntity.ok(new ApiResponse(true, "All notifications marked as read."));
    }

    @DeleteMapping("/clear")
    public ResponseEntity<?> clearAllNotifications(Authentication auth) {
        User user = getAuthenticatedUser(auth);
        if (user != null) {
            notificationService.clearAllNotifications(user);
        }
        return ResponseEntity.ok(new ApiResponse(true, "All notifications cleared."));
    }
}
