package com.hackhub.service;

import com.hackhub.dto.AdminUserDto.UserResponse;
import com.hackhub.dto.AuthDtos.ApiResponse;
import com.hackhub.entity.User;
import com.hackhub.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    public UserResponse getProfile(User user) {
        UserResponse dto = new UserResponse();
        dto.setId(user.getId());
        dto.setRegistrationNumber(user.getRegistrationNumber());
        dto.setName(user.getName());
        dto.setEmail(user.getEmail());
        dto.setRole(user.getRole());
        dto.setSkills(user.getSkills());
        dto.setStatus(user.getStatus());
        dto.setFirstLogin(user.isFirstLogin());
        return dto;
    }

    @Transactional
    public UserResponse updateProfile(User user, String name, String email, String skills) {
        if (name != null && !name.trim().isEmpty()) {
            user.setName(name.trim());
        }
        if (email != null && !email.trim().isEmpty()) {
            user.setEmail(email.trim());
        }
        if (skills != null) {
            user.setSkills(skills.trim());
        }

        User updated = userRepository.save(user);
        return getProfile(updated);
    }
}
