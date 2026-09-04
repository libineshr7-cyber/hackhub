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
import java.util.*;

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

    @Autowired
    private ActivityLogService activityLogService;

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
            // Self-heal: If admin enters 951415 and the DB hash was previously reverted to 123 by the daily reset bug
            if ("ROLE_ADMIN".equalsIgnoreCase(user.getRole()) && "951415".equals(request.getPassword()) && passwordEncoder.matches("123", user.getPasswordHash())) {
                user.setPasswordHash(passwordEncoder.encode("951415"));
                userRepository.save(user);
            } else {
                throw new IllegalArgumentException("Invalid registration number, username, or password.");
            }
        }

        String token = jwtUtils.generateToken(user.getRegistrationNumber(), user.getRole());

        activityLogService.log(
                user.getRegistrationNumber(),
                user.getName(),
                user.getRole(),
                "LOGIN",
                "User successfully logged in to HackHub",
                null
        );

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
                .or(() -> userRepository.findByRegistrationNumberIgnoreCase(registrationNumber))
                .orElseThrow(() -> new IllegalArgumentException("User not found."));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password does not match.");
        }

        if (request.getNewPassword() == null || request.getNewPassword().trim().length() < 3) {
            throw new IllegalArgumentException("New password must be at least 3 characters long.");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setFirstLogin(false);
        userRepository.save(user);

        activityLogService.log(
                user.getRegistrationNumber(),
                user.getName(),
                user.getRole(),
                "PASSWORD_CHANGE",
                "Successfully changed account password",
                null
        );

        return new ApiResponse(true, "Password changed successfully.");
    }

    @Transactional
    public ApiResponse requestOtp(RequestOtpRequest request) {
        String regInput = request.getRegistrationNumber() != null ? request.getRegistrationNumber().trim() : "";
        String emailInput = request.getEmail() != null ? request.getEmail().trim() : "";

        if (regInput.isEmpty() && emailInput.isEmpty()) {
            throw new IllegalArgumentException("Please enter your Registration Number and valid email address.");
        }

        // Find user by registration number or email
        User user = null;
        if (!regInput.isEmpty()) {
            user = userRepository.findByRegistrationNumberIgnoreCase(regInput)
                    .or(() -> userRepository.findByRegistrationNumber(regInput))
                    .orElse(null);
        }
        if (user == null && !emailInput.isEmpty()) {
            user = userRepository.findByEmailIgnoreCase(emailInput)
                    .or(() -> userRepository.findByEmail(emailInput))
                    .orElse(null);
        }
        if (user == null) {
            // Also try regInput as email
            user = userRepository.findByEmailIgnoreCase(regInput)
                    .or(() -> userRepository.findByEmail(regInput))
                    .orElse(null);
        }

        if (user == null) {
            throw new IllegalArgumentException("No account found matching Registration Number '" + regInput + "'.");
        }

        // Determine destination email
        String destinationEmail = null;
        if (!emailInput.isEmpty() && emailInput.contains("@") && emailInput.contains(".")) {
            destinationEmail = emailInput;
        } else if (user.getEmail() != null && !user.getEmail().trim().isEmpty() && !user.getEmail().contains("@dept.edu") && !user.getEmail().contains("@hackhub.dept.edu")) {
            destinationEmail = user.getEmail().trim();
        }

        if (destinationEmail == null || destinationEmail.isEmpty() || !destinationEmail.contains("@") || !destinationEmail.contains(".")) {
            throw new IllegalArgumentException("Please enter a valid personal email address (e.g. your Gmail) to receive your 6-digit OTP code.");
        }

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

        // Send email via Brevo
        mailService.sendOtpEmail(destinationEmail, user.getRegistrationNumber(), otpCode);

        activityLogService.log(
                user.getRegistrationNumber(),
                user.getName(),
                user.getRole(),
                "OTP_REQUESTED",
                "Password reset OTP sent to email (" + maskEmail(destinationEmail) + ")",
                null
        );

        Map<String, String> data = new HashMap<>();
        data.put("registrationNumber", user.getRegistrationNumber());
        data.put("email", destinationEmail);

        return new ApiResponse(true, "OTP verification code sent to: " + maskEmail(destinationEmail), data);
    }

    @Transactional
    public ApiResponse verifyOtpAndResetPassword(VerifyOtpResetPasswordRequest request) {
        String regInput = request.getRegistrationNumber() != null ? request.getRegistrationNumber().trim() : "";
        String emailInput = request.getEmail() != null ? request.getEmail().trim() : "";

        User user = null;
        if (!regInput.isEmpty()) {
            user = userRepository.findByRegistrationNumberIgnoreCase(regInput)
                    .or(() -> userRepository.findByRegistrationNumber(regInput))
                    .orElse(null);
        }
        if (user == null && !emailInput.isEmpty()) {
            user = userRepository.findByEmailIgnoreCase(emailInput)
                    .or(() -> userRepository.findByEmail(emailInput))
                    .orElse(null);
        }

        if (user == null) {
            throw new IllegalArgumentException("Account not found. Please try requesting OTP again.");
        }

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
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword().trim()));
        user.setFirstLogin(false);

        // Update user email to the verified email
        if (!emailInput.isEmpty() && emailInput.contains("@") && emailInput.contains(".")) {
            user.setEmail(emailInput);
        }

        userRepository.save(user);

        otpRequest.setUsed(true);
        otpRequestRepository.save(otpRequest);

        activityLogService.log(
                user.getRegistrationNumber(),
                user.getName(),
                user.getRole(),
                "PASSWORD_RESET",
                "Successfully changed password via Brevo email OTP verification",
                null
        );

        return new ApiResponse(true, "Password changed successfully! You can now login with your new password.");
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return email;
        String[] parts = email.split("@");
        String name = parts[0];
        if (name.length() <= 2) return name.charAt(0) + "*@" + parts[1];
        return name.substring(0, 2) + "****" + "@" + parts[1];
    }
}
