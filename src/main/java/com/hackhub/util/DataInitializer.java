package com.hackhub.util;

import com.hackhub.entity.Event;
import com.hackhub.entity.User;
import com.hackhub.repository.EventRepository;
import com.hackhub.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(DataInitializer.class);

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        logger.info("==================================================");
        logger.info("🚀 Initializing HackHub Database & Initial Accounts...");

        // 1. Seed Admin Account (Admin / 123)
        User admin = userRepository.findByRegistrationNumber("Admin").orElseGet(() -> {
            User newAdmin = new User();
            newAdmin.setRegistrationNumber("Admin");
            newAdmin.setName("Department Admin");
            newAdmin.setEmail("admin@hackhub.dept.edu");
            newAdmin.setPasswordHash(passwordEncoder.encode("123"));
            newAdmin.setRole("ROLE_ADMIN");
            newAdmin.setStatus("ACTIVE");
            newAdmin.setDepartment("CS");
            newAdmin.setSkills("Administration, Cybersecurity, Governance");
            newAdmin.setFirstLogin(false);
            User saved = userRepository.save(newAdmin);
            logger.info("✅ Admin account created: RegNo Admin | Password 123");
            return saved;
        });

        // Safely reassign events created by legacy 000 to new Admin, then remove/disable 000
        try {
            userRepository.findByRegistrationNumber("000").ifPresent(oldAdmin -> {
                try {
                    List<Event> allEvents = eventRepository.findAll();
                    for (Event event : allEvents) {
                        if (event.getCreatedBy() != null && oldAdmin.getId().equals(event.getCreatedBy().getId())) {
                            event.setCreatedBy(admin);
                            eventRepository.save(event);
                        }
                    }
                    userRepository.delete(oldAdmin);
                    logger.info("🗑️ Reassigned events and removed legacy admin account 000");
                } catch (Exception ex) {
                    oldAdmin.setStatus("DISABLED");
                    userRepository.save(oldAdmin);
                    logger.warn("⚠️ Legacy admin 000 disabled instead of deleted: {}", ex.getMessage());
                }
            });
        } catch (Exception e) {
            logger.warn("⚠️ Legacy admin migration skipped: {}", e.getMessage());
        }

        // 2. Map & Migrate all legacy database accounts to CS2001-CS2049 and CS3001-CS3048
        List<String> sampleSkillsList = Arrays.asList(
                "Python, Cybersecurity",
                "Java, Web Development",
                "UI/UX, HTML/CSS",
                "AI/ML, Python",
                "Networking, Cloud",
                "Database, SQL",
                "React, Node.js",
                "C++, Algorithms"
        );

        String defaultPassHash = passwordEncoder.encode("123");

        // Map of legacy registration numbers -> target new registration numbers
        Map<String, String> legacyMapping = new HashMap<>();
        for (int i = 1; i <= 49; i++) {
            String target = String.format("CS%04d", 2000 + i);
            legacyMapping.put(String.format("CS%03d", i), target);
            legacyMapping.put(String.format("%03d", i), target);
            legacyMapping.put(String.format("CS0%02d", i), target);
        }
        for (int i = 1; i <= 48; i++) {
            String target = String.format("CS%04d", 3000 + i);
            legacyMapping.put(String.format("CS%03d", 100 + i), target);
            legacyMapping.put(String.format("%03d", 100 + i), target);
            legacyMapping.put(String.format("CS%03d", 50 + i), target);
        }

        // Migrate all existing database users
        List<User> existingUsers = userRepository.findAll();
        for (User u : existingUsers) {
            String reg = u.getRegistrationNumber();
            if (reg == null) continue;

            // Admin & Sub-Admins
            if (reg.equalsIgnoreCase("Admin") || "ROLE_SUBADMIN".equals(u.getRole())) {
                u.setPasswordHash(defaultPassHash);
                userRepository.save(u);
                continue;
            }

            // Always reset password to 123
            u.setPasswordHash(defaultPassHash);

            if (legacyMapping.containsKey(reg)) {
                String targetReg = legacyMapping.get(reg);
                Optional<User> targetUser = userRepository.findByRegistrationNumber(targetReg);
                if (targetUser.isPresent() && !targetUser.get().getId().equals(u.getId())) {
                    User placeholder = targetUser.get();
                    for (Event ev : eventRepository.findAll()) {
                        if (ev.getCreatedBy() != null && placeholder.getId().equals(ev.getCreatedBy().getId())) {
                            ev.setCreatedBy(u);
                            eventRepository.save(ev);
                        }
                    }
                    try {
                        userRepository.delete(placeholder);
                    } catch (Exception ex) {
                        placeholder.setRegistrationNumber("TEMP_OLD_" + placeholder.getId());
                        userRepository.save(placeholder);
                    }
                }
                u.setRegistrationNumber(targetReg);
                if (u.getName() == null || u.getName().startsWith("Student CS0") || u.getName().startsWith("Student 0") || u.getName().startsWith("Student CS1") || u.getName().startsWith("Student 1")) {
                    u.setName("Student " + targetReg);
                }
                u.setEmail("student" + targetReg.toLowerCase() + "@hackhub.dept.edu");
                u.setDepartment("CS");
                u.setRole("ROLE_STUDENT");
                u.setStatus("ACTIVE");
                logger.info("🔄 Migrated database user {} -> {}", reg, targetReg);
            } else if (!reg.matches("^CS[23][0-9]{3}$")) {
                // Obsolete legacy accounts (000, 050, etc.)
                try {
                    for (Event ev : eventRepository.findAll()) {
                        if (ev.getCreatedBy() != null && u.getId().equals(ev.getCreatedBy().getId())) {
                            ev.setCreatedBy(admin);
                            eventRepository.save(ev);
                        }
                    }
                    userRepository.delete(u);
                    logger.info("🗑️ Cleaned up obsolete user {}", reg);
                    continue;
                } catch (Exception ex) {
                    u.setStatus("DISABLED");
                }
            }

            userRepository.save(u);
        }

        // Ensure all CS2001-CS2049 (2nd Year) exist with password 123
        for (int i = 1; i <= 49; i++) {
            String regNo = String.format("CS%04d", 2000 + i);
            User student = userRepository.findByRegistrationNumber(regNo).orElseGet(User::new);
            student.setRegistrationNumber(regNo);
            if (student.getName() == null || student.getName().startsWith("Student CS0") || student.getName().startsWith("Student 0")) {
                student.setName("Student " + regNo);
            }
            student.setEmail("student" + regNo.toLowerCase() + "@hackhub.dept.edu");
            student.setPasswordHash(defaultPassHash);
            student.setRole("ROLE_STUDENT");
            student.setStatus("ACTIVE");
            student.setDepartment("CS");
            if (student.getSkills() == null || student.getSkills().isEmpty()) {
                student.setSkills(sampleSkillsList.get(i % sampleSkillsList.size()));
            }
            userRepository.save(student);
        }

        // Ensure all CS3001-CS3048 (3rd Year) exist with password 123
        for (int i = 1; i <= 48; i++) {
            String regNo = String.format("CS%04d", 3000 + i);
            User student = userRepository.findByRegistrationNumber(regNo).orElseGet(User::new);
            student.setRegistrationNumber(regNo);
            if (student.getName() == null || student.getName().startsWith("Student CS1") || student.getName().startsWith("Student 1")) {
                student.setName("Student " + regNo);
            }
            student.setEmail("student" + regNo.toLowerCase() + "@hackhub.dept.edu");
            student.setPasswordHash(defaultPassHash);
            student.setRole("ROLE_STUDENT");
            student.setStatus("ACTIVE");
            student.setDepartment("CS");
            if (student.getSkills() == null || student.getSkills().isEmpty()) {
                student.setSkills(sampleSkillsList.get(i % sampleSkillsList.size()));
            }
            userRepository.save(student);
        }

        // Guarantee all users in database have password '123' and status 'ACTIVE'
        for (User u : userRepository.findAll()) {
            if (!"DISABLED".equals(u.getStatus())) {
                u.setPasswordHash(defaultPassHash);
                u.setStatus("ACTIVE");
                userRepository.save(u);
            }
        }

        logger.info("✅ Student accounts sync complete: CS2001-CS2049 (49) & CS3001-CS3048 (48) with password '123'.");

        // 3. Seed Sample Department Hackathons & Events if empty
        if (eventRepository.count() == 0) {
            User creator = userRepository.findByRegistrationNumber("CS2001").orElse(null);
            if (creator == null) {
                creator = userRepository.findAll().get(0);
            }

            LocalDate today = LocalDate.now();

            Event e1 = new Event();
            e1.setTitle("National Cyber Security Hackathon 2026");
            e1.setDescription("Build next-generation threat detection algorithms, CTF defense tools, and zero-trust security prototypes in a 48-hour intensive department hackathon!");
            e1.setEventType("HACKATHON");
            e1.setTeamSizeMin(2);
            e1.setTeamSizeMax(4);
            e1.setStartDate(today.plusDays(10));
            e1.setEndDate(today.plusDays(12));
            e1.setRegistrationDeadline(today.plusDays(7));
            e1.setMode("HYBRID");
            e1.setVenue("Auditorium B & Discord Server");
            e1.setRegistrationLink("https://cyberhack2026.dept.edu/register");
            e1.setSkills("Python, Cybersecurity, Networking");
            e1.setPosterPath("https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80");
            e1.setCreatedBy(creator);
            eventRepository.save(e1);

            Event e2 = new Event();
            e2.setTitle("AI & Machine Learning Innovation Challenge");
            e2.setDescription("Solve real-world healthcare and automated security classification challenges using PyTorch, TensorFlow, and LLM fine-tuning.");
            e2.setEventType("COMPETITION");
            e2.setTeamSizeMin(1);
            e2.setTeamSizeMax(3);
            e2.setStartDate(today.plusDays(3));
            e2.setEndDate(today.plusDays(4));
            e2.setRegistrationDeadline(today.plusDays(1)); // Deadline Soon!
            e2.setMode("ONLINE");
            e2.setVenue("Online Virtual Lab");
            e2.setRegistrationLink("https://ai-challenge.dept.edu");
            e2.setSkills("AI/ML, Python, Database");
            e2.setPosterPath("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80");
            e2.setCreatedBy(creator);
            eventRepository.save(e2);

            Event e3 = new Event();
            e3.setTitle("Web Development & UI/UX Sprint");
            e3.setDescription("Design and implement high-performance, mobile-first web applications using modern Web standards, CSS grid, and micro-interactions.");
            e3.setEventType("WORKSHOP");
            e3.setTeamSizeMin(1);
            e3.setTeamSizeMax(2);
            e3.setStartDate(today.minusDays(5));
            e3.setEndDate(today.minusDays(3)); // Ended Event
            e3.setRegistrationDeadline(today.minusDays(7));
            e3.setMode("OFFLINE");
            e3.setVenue("Computer Lab 3");
            e3.setRegistrationLink("https://websprint.dept.edu");
            e3.setSkills("HTML/CSS, UI/UX, React");
            e3.setPosterPath("https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80");
            e3.setCreatedBy(creator);
            eventRepository.save(e3);

            logger.info("✅ Seeded sample department events and hackathons.");
        }

        logger.info("==================================================");
    }
}
