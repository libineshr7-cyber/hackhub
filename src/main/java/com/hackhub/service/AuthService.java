package com.hackhub.service;

import com.hackhub.dto.AuthDtos.*;
import com.hackhub.entity.OtpRequest;
import com.hackhub.entity.User;
import com.hackhub.repository.OtpRequestRepository;
import com.hackhub.repository.UserRepository;
import com.hackhub.security.JwtUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OtpRequestRepository otpRequestRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private MailService mailService;

    private static final SecureRandom random = new SecureRandom();

    public LoginResponse login(LoginRequest request) {
        String identifier = request.getRegistrationNumber() != null ? request.getRegistrationNumber().trim() : "";
        User user = userRepository.findByRegistrationNumber(identifier)
                .or(() -> userRepository.findByRegistrationNumberIgnoreCase(identifier))
                .or(() -> userRepository.findByEmailIgnoreCase(identifier))
                .or(() -> userRepository.findByNameIgnoreCase(identifier))
                .orElseThrow(() -> new IllegalArgumentException("Invalid registration number, username, or password."));

        if ("DISABLED".equalsIgnoreCase(user.getStatus())) {
            throw new IllegalStateException("Account is disabled. Please contact department admin.");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid registration number, username, or password.");
        }

        String token = jwtUtils.generateToken(user.getRegistrationNumber(), user.getRole());

        return new LoginResponse(
                token,
                user.getId(),
                user.getRegistrationNumber(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.isFirstLogin(),
                user.getSkills()
        );
    }

    @Transactional
    public ApiResponse changePassword(String registrationNumber, ChangePasswordRequest request) {
        User user = userRepository.findByRegistrationNumber(registrationNumber)
                .orElseThrow(() -> new IllegalArgumentException("Student not found."));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password does not match.");
        }

        if (request.getNewPassword() == null || request.getNewPassword().trim().length() < 3) {
            throw new IllegalArgumentException("New password must be at least 3 characters long.");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setFirstLogin(false);
        userRepository.save(user);

        return new ApiResponse(true, "Password changed successfully.");
    }

    @Transactional
    public ApiResponse requestOtp(RequestOtpRequest request) {
        User user = userRepository.findByRegistrationNumber(request.getRegistrationNumber())
                .orElseThrow(() -> new IllegalArgumentException("Student registration number not found."));

        // Invalidate any previous unused OTP requests for this user
        List<OtpRequest> oldOtps = otpRequestRepository.findByUserAndCreatedAtGreaterThan(user, LocalDateTime.now().minusDays(1));
        for (OtpRequest old : oldOtps) {
            old.setUsed(true);
        }
        otpRequestRepository.saveAll(oldOtps);

        // Generate 6-digit OTP
        int otpCodeInt = 100000 + random.nextInt(900000);
        String otpCode = String.valueOf(otpCodeInt);
        String otpHash = passwordEncoder.encode(otpCode);

        // Save OTP request with 5 minute expiration
        OtpRequest otpRequest = new OtpRequest(user, otpHash, LocalDateTime.now().plusMinutes(5));
        otpRequestRepository.save(otpRequest);

        // Send email
        mailService.sendOtpEmail(user.getEmail(), user.getRegistrationNumber(), otpCode);

        return new ApiResponse(true, "OTP verification code sent to registered email: " + maskEmail(user.getEmail()));
    }

    @Transactional
    public ApiResponse verifyOtpAndResetPassword(VerifyOtpResetPasswordRequest request) {
        User user = userRepository.findByRegistrationNumber(request.getRegistrationNumber())
                .orElseThrow(() -> new IllegalArgumentException("Student registration number not found."));

        Optional<OtpRequest> otpOpt = otpRequestRepository.findTopByUserAndUsedFalseAndExpiresAtGreaterThanOrderByCreatedAtDesc(
                user, LocalDateTime.now());

        if (otpOpt.isEmpty()) {
            throw new IllegalArgumentException("Invalid or expired OTP. Please request a new OTP code.");
        }

        OtpRequest otpRequest = otpOpt.get();

        if (otpRequest.getAttempts() >= 3) {
            otpRequest.setUsed(true);
            otpRequestRepository.save(otpRequest);
            throw new IllegalStateException("Maximum OTP verification attempts exceeded. Please request a new OTP.");
        }

        otpRequest.setAttempts(otpRequest.getAttempts() + 1);

        String inputOtp = request.getOtp() != null ? request.getOtp().trim() : "";
        if (!passwordEncoder.matches(inputOtp, otpRequest.getOtpHash())) {
            otpRequestRepository.save(otpRequest);
            throw new IllegalArgumentException("Invalid OTP code. Remaining attempts: " + (3 - otpRequest.getAttempts()));
        }

        if (request.getNewPassword() == null || request.getNewPassword().trim().length() < 3) {
            otpRequestRepository.save(otpRequest);
            throw new IllegalArgumentException("New password must be at least 3 characters long.");
        }

        // OTP Verified successfully
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setFirstLogin(false);
        userRepository.save(user);

        otpRequest.setUsed(true);
        otpRequestRepository.save(otpRequest);

        return new ApiResponse(true, "Password reset successfully. You can now login with your new password.");
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return email;
        String[] parts = email.split("@");
        String name = parts[0];
        if (name.length() <= 2) return name.charAt(0) + "*@" + parts[1];
        return name.substring(0, 2) + "****" + "@" + parts[1];
    }
}
