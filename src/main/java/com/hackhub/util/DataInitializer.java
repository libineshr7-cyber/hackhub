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
import java.util.*;

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

        // 1. Seed or preserve Admin Account
        Optional<User> adminOpt = userRepository.findByRegistrationNumberIgnoreCase("Admin");
        if (adminOpt.isEmpty()) {
            List<User> admins = userRepository.findByRole("ROLE_ADMIN");
            if (!admins.isEmpty()) {
                adminOpt = Optional.of(admins.get(0));
            }
        }

        if (adminOpt.isEmpty()) {
            User newAdmin = new User();
            newAdmin.setRegistrationNumber("Admin");
            newAdmin.setName("Department Admin");
            newAdmin.setEmail("admin@hackhub.dept.edu");
            newAdmin.setPasswordHash(passwordEncoder.encode("951415"));
            newAdmin.setRole("ROLE_ADMIN");
            newAdmin.setStatus("ACTIVE");
            newAdmin.setDepartment("CS");
            newAdmin.setSkills("Administration, Cybersecurity, Governance");
            newAdmin.setFirstLogin(false);
            userRepository.save(newAdmin);
            logger.info("✅ Admin account created: RegNo Admin | Password 951415");
        } else {
            User existingAdmin = adminOpt.get();
            // If admin password was reverted to temporary '123' by previous startup reset bug,
            // restore it to the admin's chosen password '951415'
            if (passwordEncoder.matches("123", existingAdmin.getPasswordHash())) {
                existingAdmin.setPasswordHash(passwordEncoder.encode("951415"));
                userRepository.save(existingAdmin);
                logger.info("🔒 Restored Admin password to 951415 (fixed previous reset to 123).");
            } else {
                logger.info("🔒 Admin account exists with custom password preserved.");
            }
        }

        // Clean up legacy 000 if present
        try {
            userRepository.findByRegistrationNumberIgnoreCase("000").ifPresent(oldAdmin -> {
                User admin = userRepository.findByRegistrationNumberIgnoreCase("Admin").orElse(null);
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
                }
            });
        } catch (Exception e) {
            logger.warn("⚠️ Legacy admin migration skipped: {}", e.getMessage());
        }

        // 2. Seed student accounts ONLY if database has no students yet (Initial setup)
        // Existing students, their modified emails, skills, and passwords are NEVER touched or reset!
        long existingStudentCount = userRepository.countByRole("ROLE_STUDENT");
        if (existingStudentCount == 0) {
            logger.info("🌱 No students found in database. Performing one-time initial seed for CS2001-CS2049 & CS3001-CS3048...");
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

            // Seed CS2001-CS2049 (2nd Year)
            for (int i = 1; i <= 49; i++) {
                String regNo = String.format("CS%04d", 2000 + i);
                User student = new User();
                student.setRegistrationNumber(regNo);
                student.setName("Student " + regNo);
                student.setEmail("student" + regNo.toLowerCase() + "@hackhub.dept.edu");
                student.setPasswordHash(defaultPassHash);
                student.setRole("ROLE_STUDENT");
                student.setStatus("ACTIVE");
                student.setDepartment("CS");
                student.setSkills(sampleSkillsList.get(i % sampleSkillsList.size()));
                student.setFirstLogin(true);
                userRepository.save(student);
            }

            // Seed CS3001-CS3048 (3rd Year)
            for (int i = 1; i <= 48; i++) {
                String regNo = String.format("CS%04d", 3000 + i);
                User student = new User();
                student.setRegistrationNumber(regNo);
                student.setName("Student " + regNo);
                student.setEmail("student" + regNo.toLowerCase() + "@hackhub.dept.edu");
                student.setPasswordHash(defaultPassHash);
                student.setRole("ROLE_STUDENT");
                student.setStatus("ACTIVE");
                student.setDepartment("CS");
                student.setSkills(sampleSkillsList.get(i % sampleSkillsList.size()));
                student.setFirstLogin(true);
                userRepository.save(student);
            }
            logger.info("✅ Initial student accounts seeded (49 2nd year + 48 3rd year).");
        } else {
            logger.info("✅ Database already has {} student accounts. Preserving all existing credentials, emails, and skills forever.", existingStudentCount);
        }

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
