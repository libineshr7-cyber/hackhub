package com.hackhub.service;

import com.hackhub.dto.AdminUserDto.*;
import com.hackhub.dto.AuthDtos.ApiResponse;
import com.hackhub.dto.TeamDtos.TeamResponse;
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
    private TeamRepository teamRepository;

    @Autowired
    private TeamService teamService;

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
        stats.setTotalTeams(teamRepository.count());
        return stats;
    }

    public List<TeamResponse> getAllTeamsForAdmin() {
        return teamService.getAllTeams(null);
    }

    @Transactional
    public ApiResponse deleteTeamByAdmin(Long teamId, User caller) {
        if (caller == null || (!"ROLE_ADMIN".equals(caller.getRole()) && !"ROLE_SUBADMIN".equals(caller.getRole()))) {
            throw new IllegalArgumentException("Unauthorized: Admin privilege required.");
        }
        return teamService.deleteTeam(teamId, caller);
    }

    /**
     * Helper to verify if student's registration number matches assigned year scope
     */
    private boolean matchesYearScope(String regNo, String assignedYear) {
        if (assignedYear == null || "ALL".equalsIgnoreCase(assignedYear.trim()) || assignedYear.trim().isEmpty()) {
            return true;
        }
        if (regNo == null) return false;
        String yearNum = assignedYear.replaceAll("[^0-9]", "").trim();
        if (yearNum.isEmpty()) return true;

        String upperReg = regNo.toUpperCase();
        // Matches CS2xxx for year 2, CS3xxx for year 3, etc.
        return upperReg.contains(yearNum + "0") || upperReg.startsWith("CS" + yearNum) || upperReg.matches("^.*" + yearNum + "[0-9]{3}$");
    }

    /**
     * Get students — Admin sees all, Sub-Admin sees their department & assigned year only.
     */
    public List<UserResponse> getStudents(String search, String callerRole, String callerDepartment, String callerAssignedYear) {
        List<User> users;
        if (search != null && !search.trim().isEmpty()) {
            users = userRepository.findByRegistrationNumberContainingOrNameContaining(search.trim(), search.trim());
        } else {
            users = userRepository.findAll();
        }

        return users.stream()
                .filter(u -> "ROLE_STUDENT".equals(u.getRole()))
                .filter(u -> {
                    if ("ROLE_SUBADMIN".equals(callerRole)) {
                        // Sub-admin: only see their own department students
                        if (callerDepartment != null && !callerDepartment.equalsIgnoreCase(u.getDepartment())) {
                            return false;
                        }
                        // Sub-admin: only see their assigned year batch
                        if (!matchesYearScope(u.getRegistrationNumber(), callerAssignedYear)) {
                            return false;
                        }
                    }
                    return true; // Admin sees all
                })
                .map(this::mapToUserResponse)
                .collect(Collectors.toList());
    }

    // Keep old signature for backward compat
    public List<UserResponse> getStudents(String search) {
        return getStudents(search, "ROLE_ADMIN", null, "ALL");
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
        user.setEmail(request.getEmail() != null && !request.getEmail().trim().isEmpty() ? request.getEmail().trim() : "student" + regNo.toLowerCase() + "@hackhub.dept.edu");
        user.setPasswordHash(passwordEncoder.encode("123"));
        user.setRole("ROLE_STUDENT");
        user.setStatus("ACTIVE");
        user.setSkills(request.getSkills() != null ? request.getSkills().trim() : "Python, Java");
        user.setDepartment(request.getDepartment() != null ? request.getDepartment().trim().toUpperCase() : "CS");
        user.setFirstLogin(true);

        User saved = userRepository.save(user);
        return mapToUserResponse(saved);
    }

    @Transactional
    public ApiResponse updateStudentStatus(Long studentId, String status, User caller) {
        User user = userRepository.findById(studentId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found with ID: " + studentId));

        if ("ROLE_ADMIN".equalsIgnoreCase(user.getRole())) {
            throw new IllegalStateException("Cannot change status of Admin user.");
        }

        if (caller != null && "ROLE_SUBADMIN".equals(caller.getRole())) {
            if (caller.getDepartment() != null && !caller.getDepartment().equalsIgnoreCase(user.getDepartment())) {
                throw new IllegalArgumentException("Unauthorized: Cannot modify students outside your department.");
            }
            if (!matchesYearScope(user.getRegistrationNumber(), caller.getAssignedYear())) {
                throw new IllegalArgumentException("Unauthorized: Cannot modify students outside your assigned year.");
            }
        }

        if (!"ACTIVE".equalsIgnoreCase(status) && !"DISABLED".equalsIgnoreCase(status)) {
            throw new IllegalArgumentException("Status must be ACTIVE or DISABLED.");
        }

        user.setStatus(status.toUpperCase());
        userRepository.save(user);

        return new ApiResponse(true, "Account status updated to " + status.toUpperCase());
    }

    @Transactional
    public ApiResponse resetStudentPassword(Long studentId, User caller) {
        User user = userRepository.findById(studentId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found with ID: " + studentId));

        if (caller != null && "ROLE_SUBADMIN".equals(caller.getRole())) {
            if (caller.getDepartment() != null && !caller.getDepartment().equalsIgnoreCase(user.getDepartment())) {
                throw new IllegalArgumentException("Unauthorized: Cannot reset password for students outside your department.");
            }
            if (!matchesYearScope(user.getRegistrationNumber(), caller.getAssignedYear())) {
                throw new IllegalArgumentException("Unauthorized: Cannot reset password for students outside your assigned year.");
            }
        }

        user.setPasswordHash(passwordEncoder.encode("123"));
        user.setFirstLogin(true);
        userRepository.save(user);

        return new ApiResponse(true, "Password for " + user.getRegistrationNumber() + " has been reset to temporary password '123'.");
    }

    @Transactional
    public ApiResponse deleteStudent(Long studentId, User caller) {
        if (caller == null || !"ROLE_ADMIN".equals(caller.getRole())) {
            throw new IllegalArgumentException("Unauthorized: Only Admin has permission to delete student accounts.");
        }

        User user = userRepository.findById(studentId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found with ID: " + studentId));

        if ("ROLE_ADMIN".equalsIgnoreCase(user.getRole())) {
            throw new IllegalStateException("Cannot delete Admin user.");
        }

        userRepository.delete(user);
        return new ApiResponse(true, "Student account '" + user.getRegistrationNumber() + "' deleted successfully.");
    }

    // =====================================================================
    // SUB-ADMIN MANAGEMENT (Only callable by ROLE_ADMIN)
    // =====================================================================

    public List<UserResponse> getSubAdmins() {
        List<User> subAdmins = userRepository.findByRole("ROLE_SUBADMIN");
        return subAdmins.stream().map(this::mapToUserResponse).collect(Collectors.toList());
    }

    @Transactional
    public UserResponse createSubAdmin(CreateSubAdminRequest request) {
        if (request.getRegistrationNumber() == null || request.getRegistrationNumber().trim().isEmpty()) {
            throw new IllegalArgumentException("Registration number is required.");
        }
        if (request.getDepartment() == null || request.getDepartment().trim().isEmpty()) {
            throw new IllegalArgumentException("Department is required for Sub-Admin.");
        }

        String regNo = request.getRegistrationNumber().trim().toUpperCase();
        if (userRepository.existsByRegistrationNumber(regNo)) {
            throw new IllegalArgumentException("Account with registration number '" + regNo + "' already exists.");
        }

        User user = new User();
        user.setRegistrationNumber(regNo);
        user.setName(request.getName() != null && !request.getName().trim().isEmpty() ? request.getName().trim() : "SubAdmin " + regNo);
        user.setEmail(request.getEmail() != null && !request.getEmail().trim().isEmpty() ? request.getEmail().trim() : "subadmin." + request.getDepartment().toLowerCase() + "@hackhub.dept.edu");
        user.setPasswordHash(passwordEncoder.encode("123"));
        user.setRole("ROLE_SUBADMIN");
        user.setStatus("ACTIVE");
        user.setSkills("");
        user.setDepartment(request.getDepartment().trim().toUpperCase());
        user.setAssignedYear(request.getAssignedYear() != null && !request.getAssignedYear().trim().isEmpty() ? request.getAssignedYear().trim() : "ALL");
        user.setFirstLogin(true);

        User saved = userRepository.save(user);
        return mapToUserResponse(saved);
    }

    @Transactional
    public ApiResponse updateSubAdmin(Long id, UpdateSubAdminRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Sub-Admin not found with ID: " + id));

        if (!"ROLE_SUBADMIN".equals(user.getRole())) {
            throw new IllegalStateException("User is not a Sub-Admin.");
        }

        if (request.getName() != null && !request.getName().trim().isEmpty()) {
            user.setName(request.getName().trim());
        }
        if (request.getEmail() != null && !request.getEmail().trim().isEmpty()) {
            user.setEmail(request.getEmail().trim());
        }
        if (request.getDepartment() != null && !request.getDepartment().trim().isEmpty()) {
            user.setDepartment(request.getDepartment().trim().toUpperCase());
        }
        if (request.getAssignedYear() != null && !request.getAssignedYear().trim().isEmpty()) {
            user.setAssignedYear(request.getAssignedYear().trim());
        }
        userRepository.save(user);

        return new ApiResponse(true, "Sub-Admin '" + user.getRegistrationNumber() + "' updated successfully.");
    }

    @Transactional
    public ApiResponse updateSubAdminStatus(Long id, String status) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Sub-Admin not found with ID: " + id));

        if (!"ROLE_SUBADMIN".equals(user.getRole())) {
            throw new IllegalStateException("User is not a Sub-Admin.");
        }

        if (!"ACTIVE".equalsIgnoreCase(status) && !"DISABLED".equalsIgnoreCase(status)) {
            throw new IllegalArgumentException("Status must be ACTIVE or DISABLED.");
        }

        user.setStatus(status.toUpperCase());
        userRepository.save(user);

        return new ApiResponse(true, "Sub-Admin '" + user.getRegistrationNumber() + "' status updated to " + status.toUpperCase());
    }

    @Transactional
    public ApiResponse resetSubAdminPassword(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Sub-Admin not found with ID: " + id));

        if (!"ROLE_SUBADMIN".equals(user.getRole())) {
            throw new IllegalStateException("User is not a Sub-Admin.");
        }

        user.setPasswordHash(passwordEncoder.encode("123"));
        user.setFirstLogin(true);
        userRepository.save(user);

        return new ApiResponse(true, "Password for Sub-Admin '" + user.getRegistrationNumber() + "' has been reset to '123'.");
    }

    // =====================================================================
    // USER LOGS (Admin Only)
    // =====================================================================

    public List<UserResponse> getAllUserLogs(String search, User caller) {
        if (caller == null || !"ROLE_ADMIN".equals(caller.getRole())) {
            throw new IllegalArgumentException("Unauthorized: Only Admin can view database and audit logs.");
        }

        List<User> users;
        if (search != null && !search.trim().isEmpty()) {
            users = userRepository.findByRegistrationNumberContainingOrNameContaining(search.trim(), search.trim());
        } else {
            users = userRepository.findAll();
        }

        return users.stream()
                .map(this::mapToUserResponse)
                .collect(Collectors.toList());
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
        dto.setCreatedAt(user.getCreatedAt() != null ? user.getCreatedAt().toString() : null);
        dto.setPostedEventsCount(eventRepository.countByCreatedBy(user));
        dto.setDepartment(user.getDepartment());
        dto.setAssignedYear(user.getAssignedYear());
        return dto;
    }
}
