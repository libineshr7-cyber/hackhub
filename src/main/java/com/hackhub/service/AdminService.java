package com.hackhub.service;

import com.hackhub.dto.AdminUserDto.*;
import com.hackhub.dto.AuthDtos.ApiResponse;
import com.hackhub.dto.TeamDtos.TeamResponse;
import com.hackhub.entity.ActivityLog;
import com.hackhub.entity.User;
import com.hackhub.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Collections;
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
    private ActivityLogService activityLogService;

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
        stats.setTotalLogs(activityLogService.getTotalLogsCount());
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
        ApiResponse res = teamService.deleteTeam(teamId, caller);
        activityLogService.log(
                caller.getRegistrationNumber(),
                caller.getName(),
                caller.getRole(),
                "TEAM_DELETE",
                "Deleted team #" + teamId,
                null
        );
        return res;
    }

    /**
     * Helper to verify if student's registration number matches assigned class/year scope.
     * e.g. Year 2 (Class 2) only matches CS2xxx / 2nd year students.
     * Prevents Sub-Admin 2 from accessing Class 3 students like CS3020!
     */
    public boolean matchesYearScope(String regNo, String assignedYear) {
        if (assignedYear == null || "ALL".equalsIgnoreCase(assignedYear.trim()) || assignedYear.trim().isEmpty()) {
            return true;
        }
        if (regNo == null) return false;
        String yearNum = assignedYear.replaceAll("[^0-9]", "").trim();
        if (yearNum.isEmpty()) return true;

        String upperReg = regNo.toUpperCase().trim();
        // Strict match: Registration number starts with dept letters followed immediately by yearNum digit
        // e.g. CS2001 -> matches yearNum "2", does NOT match yearNum "3"
        // e.g. CS3020 -> matches yearNum "3", does NOT match yearNum "2"
        if (upperReg.matches("^[A-Z]*" + yearNum + "[0-9]{3,}$")) {
            return true;
        }
        return upperReg.startsWith(yearNum);
    }

    /**
     * Get students — Admin sees all, Sub-Admin sees their department & assigned class/year only (up to student limit).
     */
    public List<UserResponse> getStudents(String search, User caller) {
        List<User> users;
        if (search != null && !search.trim().isEmpty()) {
            users = userRepository.findByRegistrationNumberContainingOrNameContaining(search.trim(), search.trim());
        } else {
            users = userRepository.findAll();
        }

        var stream = users.stream()
                .filter(u -> "ROLE_STUDENT".equals(u.getRole()))
                .filter(u -> {
                    if (caller != null && "ROLE_SUBADMIN".equals(caller.getRole())) {
                        // Sub-admin: only see their own department students
                        if (caller.getDepartment() != null && !caller.getDepartment().equalsIgnoreCase(u.getDepartment())) {
                            return false;
                        }
                        // Sub-admin: strictly see their assigned class only
                        if (!matchesYearScope(u.getRegistrationNumber(), caller.getAssignedYear())) {
                            return false;
                        }
                    }
                    return true; // Admin sees all
                });

        // Enforce student limit if configured for this sub-admin
        if (caller != null && "ROLE_SUBADMIN".equals(caller.getRole()) && caller.getStudentLimit() != null && caller.getStudentLimit() > 0) {
            stream = stream.limit(caller.getStudentLimit());
        }

        return stream.map(this::mapToUserResponse).collect(Collectors.toList());
    }

    public List<UserResponse> getStudents(String search, String callerRole, String callerDepartment, String callerAssignedYear) {
        User tempCaller = new User();
        tempCaller.setRole(callerRole);
        tempCaller.setDepartment(callerDepartment);
        tempCaller.setAssignedYear(callerAssignedYear);
        return getStudents(search, tempCaller);
    }

    public List<UserResponse> getStudents(String search) {
        return getStudents(search, "ROLE_ADMIN", null, "ALL");
    }

    @Transactional
    public UserResponse createStudent(CreateStudentRequest request, User caller) {
        if (request.getRegistrationNumber() == null || request.getRegistrationNumber().trim().isEmpty()) {
            throw new IllegalArgumentException("Registration number is required.");
        }

        String regNo = request.getRegistrationNumber().trim().toUpperCase();
        if (userRepository.existsByRegistrationNumber(regNo)) {
            throw new IllegalArgumentException("Student account with registration number '" + regNo + "' already exists.");
        }

        if (caller != null && "ROLE_SUBADMIN".equals(caller.getRole())) {
            if (caller.getDepartment() != null && request.getDepartment() != null && !caller.getDepartment().equalsIgnoreCase(request.getDepartment())) {
                throw new IllegalArgumentException("Unauthorized: Cannot create students outside your department (" + caller.getDepartment() + ").");
            }
            if (!matchesYearScope(regNo, caller.getAssignedYear())) {
                throw new IllegalArgumentException("Unauthorized: Cannot create students outside your assigned class (" + caller.getAssignedYear() + ").");
            }
            if (caller.getStudentLimit() != null && caller.getStudentLimit() > 0) {
                long currentCount = userRepository.findAll().stream()
                        .filter(u -> "ROLE_STUDENT".equals(u.getRole()))
                        .filter(u -> caller.getDepartment().equalsIgnoreCase(u.getDepartment()))
                        .filter(u -> matchesYearScope(u.getRegistrationNumber(), caller.getAssignedYear()))
                        .count();
                if (currentCount >= caller.getStudentLimit()) {
                    throw new IllegalArgumentException("Unauthorized: Reached maximum student quota limit (" + caller.getStudentLimit() + ").");
                }
            }
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

        activityLogService.log(
                caller != null ? caller.getRegistrationNumber() : "ADMIN",
                caller != null ? caller.getName() : "Admin",
                caller != null ? caller.getRole() : "ROLE_ADMIN",
                "STUDENT_CREATE",
                "Created student account " + saved.getRegistrationNumber() + " (" + saved.getName() + ", Dept: " + saved.getDepartment() + ")",
                null
        );

        return mapToUserResponse(saved);
    }

    public UserResponse createStudent(CreateStudentRequest request) {
        return createStudent(request, null);
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
                throw new IllegalArgumentException("Unauthorized: Cannot modify students outside your assigned class/year.");
            }
        }

        if (!"ACTIVE".equalsIgnoreCase(status) && !"DISABLED".equalsIgnoreCase(status)) {
            throw new IllegalArgumentException("Status must be ACTIVE or DISABLED.");
        }

        user.setStatus(status.toUpperCase());
        userRepository.save(user);

        activityLogService.log(
                caller != null ? caller.getRegistrationNumber() : "ADMIN",
                caller != null ? caller.getName() : "Admin",
                caller != null ? caller.getRole() : "ROLE_ADMIN",
                "STUDENT_STATUS",
                "Changed status of student " + user.getRegistrationNumber() + " to " + status.toUpperCase(),
                null
        );

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
                throw new IllegalArgumentException("Unauthorized: Cannot reset password for students outside your assigned class/year.");
            }
        }

        user.setPasswordHash(passwordEncoder.encode("123"));
        user.setFirstLogin(true);
        userRepository.save(user);

        activityLogService.log(
                caller != null ? caller.getRegistrationNumber() : "ADMIN",
                caller != null ? caller.getName() : "Admin",
                caller != null ? caller.getRole() : "ROLE_ADMIN",
                "PASSWORD_RESET",
                "Reset password for student " + user.getRegistrationNumber() + " to temporary '123'",
                null
        );

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

        activityLogService.log(
                caller.getRegistrationNumber(),
                caller.getName(),
                caller.getRole(),
                "STUDENT_DELETE",
                "Permanently deleted student account " + user.getRegistrationNumber() + " (" + user.getName() + ")",
                null
        );

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
        user.setStudentLimit(request.getStudentLimit() != null && request.getStudentLimit() > 0 ? request.getStudentLimit() : null);
        user.setFirstLogin(true);

        User saved = userRepository.save(user);

        activityLogService.log(
                "Admin",
                "Department Admin",
                "ROLE_ADMIN",
                "SUBADMIN_CREATE",
                "Created Sub-Admin '" + regNo + "' for Dept " + saved.getDepartment() +
                " (Class: " + saved.getAssignedYear() + ", Limit: " + (saved.getStudentLimit() != null ? saved.getStudentLimit() + " students" : "Unlimited") + ")",
                null
        );

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
        if (request.getStudentLimit() != null) {
            user.setStudentLimit(request.getStudentLimit() > 0 ? request.getStudentLimit() : null);
        }
        userRepository.save(user);

        activityLogService.log(
                "Admin",
                "Department Admin",
                "ROLE_ADMIN",
                "SUBADMIN_UPDATE",
                "Updated Sub-Admin '" + user.getRegistrationNumber() + "' (Dept: " + user.getDepartment() +
                ", Class: " + user.getAssignedYear() + ", Limit: " + (user.getStudentLimit() != null ? user.getStudentLimit() + " students" : "Unlimited") + ")",
                null
        );

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

        activityLogService.log(
                "Admin",
                "Department Admin",
                "ROLE_ADMIN",
                "SUBADMIN_STATUS",
                "Changed Sub-Admin '" + user.getRegistrationNumber() + "' status to " + status.toUpperCase(),
                null
        );

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

        activityLogService.log(
                "Admin",
                "Department Admin",
                "ROLE_ADMIN",
                "PASSWORD_RESET",
                "Reset password for Sub-Admin '" + user.getRegistrationNumber() + "' to temporary '123'",
                null
        );

        return new ApiResponse(true, "Password for Sub-Admin '" + user.getRegistrationNumber() + "' has been reset to '123'.");
    }

    @Transactional
    public ApiResponse deleteSubAdmin(Long id, User caller) {
        if (caller == null || !"ROLE_ADMIN".equals(caller.getRole())) {
            throw new IllegalArgumentException("Unauthorized: Only Admin can delete Sub-Admin accounts.");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Sub-Admin not found with ID: " + id));

        if (!"ROLE_SUBADMIN".equals(user.getRole())) {
            throw new IllegalStateException("User is not a Sub-Admin.");
        }

        userRepository.delete(user);

        activityLogService.log(
                caller.getRegistrationNumber(),
                caller.getName(),
                caller.getRole(),
                "SUBADMIN_DELETE",
                "Deleted Sub-Admin account '" + user.getRegistrationNumber() + "'",
                null
        );

        return new ApiResponse(true, "Sub-Admin account '" + user.getRegistrationNumber() + "' deleted successfully.");
    }

    // =====================================================================
    // 24/7 AUDIT & ACTIVITY LOGS
    // =====================================================================

    public List<ActivityLog> getActivityLogs(String search, String actionFilter) {
        return activityLogService.getLogs(search, actionFilter);
    }

    @Transactional
    public ApiResponse clearActivityLogs(User caller) {
        if (caller == null || !"ROLE_ADMIN".equals(caller.getRole())) {
            throw new IllegalArgumentException("Unauthorized: Only Admin can clear activity logs.");
        }
        activityLogService.clearLogs();
        return new ApiResponse(true, "Activity logs purged successfully.");
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
        dto.setStudentLimit(user.getStudentLimit());
        return dto;
    }
}
