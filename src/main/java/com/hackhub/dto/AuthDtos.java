package com.hackhub.dto;

public class AuthDtos {

    public static class LoginRequest {
        private String registrationNumber;
        private String password;

        public String getRegistrationNumber() { return registrationNumber; }
        public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }

    public static class LoginResponse {
        private String token;
        private Long id;
        private String registrationNumber;
        private String name;
        private String email;
        private String role;
        private boolean firstLogin;
        private String skills;

        public LoginResponse(String token, Long id, String registrationNumber, String name, String email, String role, boolean firstLogin, String skills) {
            this.token = token;
            this.id = id;
            this.registrationNumber = registrationNumber;
            this.name = name;
            this.email = email;
            this.role = role;
            this.firstLogin = firstLogin;
            this.skills = skills;
        }

        public String getToken() { return token; }
        public Long getId() { return id; }
        public String getRegistrationNumber() { return registrationNumber; }
        public String getName() { return name; }
        public String getEmail() { return email; }
        public String getRole() { return role; }
        public boolean isFirstLogin() { return firstLogin; }
        public String getSkills() { return skills; }
    }

    public static class ChangePasswordRequest {
        private String currentPassword;
        private String newPassword;

        public String getCurrentPassword() { return currentPassword; }
        public void setCurrentPassword(String currentPassword) { this.currentPassword = currentPassword; }
        public String getNewPassword() { return newPassword; }
        public void setNewPassword(String newPassword) { this.newPassword = newPassword; }
    }

    public static class RequestOtpRequest {
        private String registrationNumber;

        public String getRegistrationNumber() { return registrationNumber; }
        public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }
    }

    public static class VerifyOtpResetPasswordRequest {
        private String registrationNumber;
        private String otp;
        private String newPassword;

        public String getRegistrationNumber() { return registrationNumber; }
        public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }
        public String getOtp() { return otp; }
        public void setOtp(String otp) { this.otp = otp; }
        public String getNewPassword() { return newPassword; }
        public void setNewPassword(String newPassword) { this.newPassword = newPassword; }
    }

    public static class ApiResponse {
        private boolean success;
        private String message;

        public ApiResponse(boolean success, String message) {
            this.success = success;
            this.message = message;
        }

        public boolean isSuccess() { return success; }
        public String getMessage() { return message; }
    }
}
