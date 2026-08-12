package com.hackhub.controller;

import com.hackhub.dto.AuthDtos.ApiResponse;
import com.hackhub.dto.EventDto;
import com.hackhub.entity.User;
import com.hackhub.repository.UserRepository;
import com.hackhub.service.SavedEventService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class SavedEventController {

    @Autowired
    private SavedEventService savedEventService;

    @Autowired
    private UserRepository userRepository;

    private User getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("Authentication required.");
        }
        return userRepository.findByRegistrationNumber(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + authentication.getName()));
    }

    @PostMapping("/events/{id}/save")
    public ResponseEntity<?> saveEvent(@PathVariable("id") Long id, Authentication authentication) {
        try {
            User currentUser = getCurrentUser(authentication);
            ApiResponse response = savedEventService.saveEvent(id, currentUser);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @DeleteMapping("/events/{id}/save")
    public ResponseEntity<?> unsaveEvent(@PathVariable("id") Long id, Authentication authentication) {
        try {
            User currentUser = getCurrentUser(authentication);
            ApiResponse response = savedEventService.unsaveEvent(id, currentUser);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @GetMapping("/saved-events")
    public ResponseEntity<?> getSavedEvents(Authentication authentication) {
        try {
            User currentUser = getCurrentUser(authentication);
            List<EventDto> savedEvents = savedEventService.getSavedEvents(currentUser);
            return ResponseEntity.ok(savedEvents);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }
}
