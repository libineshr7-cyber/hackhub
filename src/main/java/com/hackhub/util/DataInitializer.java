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
        if (!userRepository.existsByRegistrationNumber("Admin")) {
            User admin = new User();
            admin.setRegistrationNumber("Admin");
            admin.setName("Department Admin");
            admin.setEmail("admin@hackhub.dept.edu");
            admin.setPasswordHash(passwordEncoder.encode("123"));
            admin.setRole("ROLE_ADMIN");
            admin.setStatus("ACTIVE");
            admin.setDepartment("CS");
            admin.setSkills("Administration, Cybersecurity, Governance");
            admin.setFirstLogin(false);
            userRepository.save(admin);
            logger.info("✅ Admin account created: RegNo Admin | Password 123");
        }

        // Clean up legacy 000 admin if present
        userRepository.findByRegistrationNumber("000").ifPresent(oldAdmin -> {
            userRepository.delete(oldAdmin);
            logger.info("🗑️ Removed legacy admin account 000");
        });

        // 2. Seed Initial Student Accounts (CS2001-CS2049 and CS3001-CS3048)
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
        int countSeeded = 0;

        // Migrate legacy CS001..CS049 -> CS2001..CS2049 in DB
        List<User> allUsers = userRepository.findAll();
        for (User u : allUsers) {
            String reg = u.getRegistrationNumber();
            if (reg != null && reg.matches("^CS0[0-4][0-9]$")) {
                int num = Integer.parseInt(reg.substring(2));
                String targetReg = String.format("CS%04d", 2000 + num);
                if (!userRepository.existsByRegistrationNumber(targetReg)) {
                    u.setRegistrationNumber(targetReg);
                    if (u.getName() != null && u.getName().contains("CS0")) {
                        u.setName(u.getName().replace("CS0", "CS20"));
                    }
                    if (u.getDepartment() == null) {
                        u.setDepartment("CS");
                    }
                    userRepository.save(u);
                    logger.info("🔄 Migrated database user {} -> {}", reg, targetReg);
                }
            }
        }

        // Seed CS2001 to CS2049 (2nd Year)
        for (int i = 1; i <= 49; i++) {
            String regNo = String.format("CS%04d", 2000 + i);
            if (!userRepository.existsByRegistrationNumber(regNo)) {
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
                countSeeded++;
            }
        }

        // Seed CS3001 to CS3048 (3rd Year)
        for (int i = 1; i <= 48; i++) {
            String regNo = String.format("CS%04d", 3000 + i);
            if (!userRepository.existsByRegistrationNumber(regNo)) {
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
                countSeeded++;
            }
        }

        if (countSeeded > 0) {
            logger.info("✅ Seeded {} student accounts (CS2001-CS2049 & CS3001-CS3048) with default password '123'.", countSeeded);
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
