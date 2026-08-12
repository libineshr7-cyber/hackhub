package com.hackhub.service;

import com.hackhub.dto.AdminUserDto.*;
import com.hackhub.dto.AuthDtos.ApiResponse;
import com.hackhub.entity.User;
import com.hackhub.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class AdminService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private SavedEventRepository savedEventRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public DashboardStats getDashboardStats() {
        LocalDate today = LocalDate.now();
        DashboardStats stats = new DashboardStats();
        stats.setTotalStudents(userRepository.countByRole("ROLE_STUDENT"));
        stats.setTotalEvents(eventRepository.count());
        stats.setUpcomingEvents(eventRepository.countByEndDateGreaterThanEqual(today));
        stats.setEndedEvents(eventRepository.countByEndDateLessThan(today));
        stats.setTotalSavedEvents(savedEventRepository.count());
        stats.setTotalReports(reportRepository.count());
        stats.setPendingReports(reportRepository.countByStatus("PENDING"));
        return stats;
    }

    public List<UserResponse> getStudents(String search) {
        List<User> users;
        if (search != null && !search.trim().isEmpty()) {
            users = userRepository.findByRegistrationNumberContainingOrNameContaining(search.trim(), search.trim());
        } else {
            users = userRepository.findAll();
        }

        return users.stream()
                .filter(u -> "ROLE_STUDENT".equals(u.getRole()))
                .map(this::mapToUserResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public UserResponse createStudent(CreateStudentRequest request) {
        if (request.getRegistrationNumber() == null || request.getRegistrationNumber().trim().isEmpty()) {
            throw new IllegalArgumentException("Registration number is required.");
        }

        String regNo = request.getRegistrationNumber().trim();
        if (userRepository.existsByRegistrationNumber(regNo)) {
            throw new IllegalArgumentException("Student account with registration number '" + regNo + "' already exists.");
        }

        User user = new User();
        user.setRegistrationNumber(regNo);
        user.setName(request.getName() != null && !request.getName().trim().isEmpty() ? request.getName().trim() : "Student " + regNo);
        user.setEmail(request.getEmail() != null && !request.getEmail().trim().isEmpty() ? request.getEmail().trim() : "student" + regNo + "@hackhub.dept.edu");
        user.setPasswordHash(passwordEncoder.encode("123")); // Default initial temporary password
        user.setRole("ROLE_STUDENT");
        user.setStatus("ACTIVE");
        user.setSkills(request.getSkills() != null ? request.getSkills().trim() : "Python, Java");
        user.setFirstLogin(true);

        User saved = userRepository.save(user);
        return mapToUserResponse(saved);
    }

    @Transactional
    public ApiResponse updateStudentStatus(Long studentId, String status) {
        User user = userRepository.findById(studentId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found with ID: " + studentId));

        if ("ROLE_ADMIN".equalsIgnoreCase(user.getRole())) {
            throw new IllegalStateException("Cannot change status of Admin user.");
        }

        if (!"ACTIVE".equalsIgnoreCase(status) && !"DISABLED".equalsIgnoreCase(status)) {
            throw new IllegalArgumentException("Status must be ACTIVE or DISABLED.");
        }

        user.setStatus(status.toUpperCase());
        userRepository.save(user);

        return new ApiResponse(true, "Student account status updated to " + status.toUpperCase());
    }

    @Transactional
    public ApiResponse resetStudentPassword(Long studentId) {
        User user = userRepository.findById(studentId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found with ID: " + studentId));

        // Reset password securely to temporary password "123" without revealing current password
        user.setPasswordHash(passwordEncoder.encode("123"));
        user.setFirstLogin(true);
        userRepository.save(user);

        return new ApiResponse(true, "Password for student " + user.getRegistrationNumber() + " has been reset to temporary password '123'. First-login password change will be required.");
    }

    private UserResponse mapToUserResponse(User user) {
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
}
