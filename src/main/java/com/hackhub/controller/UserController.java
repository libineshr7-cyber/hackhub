package com.hackhub.controller;

import com.hackhub.dto.AdminUserDto.UserResponse;
import com.hackhub.dto.AuthDtos.ApiResponse;
import com.hackhub.entity.User;
import com.hackhub.repository.UserRepository;
import com.hackhub.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/user")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    private User getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("User is not authenticated.");
        }
        return userRepository.findByRegistrationNumber(authentication.getName())
                .or(() -> userRepository.findByRegistrationNumberIgnoreCase(authentication.getName()))
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + authentication.getName()));
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(Authentication authentication) {
        try {
            User currentUser = getCurrentUser(authentication);
            UserResponse response = userService.getProfile(currentUser);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(@RequestBody Map<String, String> body, Authentication authentication) {
        try {
            User currentUser = getCurrentUser(authentication);
            String name = body.get("name");
            String email = body.get("email");
            String skills = body.get("skills");
            UserResponse response = userService.updateProfile(currentUser, name, email, skills);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }
}
