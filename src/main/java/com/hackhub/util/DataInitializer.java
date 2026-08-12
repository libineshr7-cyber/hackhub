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

        // 1. Seed Admin Account (000 / admin)
        if (!userRepository.existsByRegistrationNumber("000")) {
            User admin = new User();
            admin.setRegistrationNumber("000");
            admin.setName("Department Head / Admin");
            admin.setEmail("admin@hackhub.dept.edu");
            admin.setPasswordHash(passwordEncoder.encode("admin123"));
            admin.setRole("ROLE_ADMIN");
            admin.setStatus("ACTIVE");
            admin.setSkills("Administration, Cybersecurity, Governance");
            admin.setFirstLogin(false);
            userRepository.save(admin);
            logger.info("✅ Admin account created: RegNo 000 | Password admin123");
        }

        // 2. Seed Initial Student Accounts (CS001 to CS049) & Migrate legacy numeric Reg Nos (001 -> CS001)
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

        // Migrate ALL 3-digit numeric registration numbers (e.g. 001..049 -> CS001..CS049) in DB
        List<User> allUsers = userRepository.findAll();
        for (User u : allUsers) {
            if (u.getRegistrationNumber() != null && u.getRegistrationNumber().matches("\\d{3}") && !"000".equals(u.getRegistrationNumber())) {
                String oldReg = u.getRegistrationNumber();
                String newReg = "CS" + oldReg;
                u.setRegistrationNumber(newReg);
                if (u.getName().startsWith("Student ") && !u.getName().contains("CS")) {
                    u.setName("Student " + newReg);
                }
                userRepository.save(u);
                logger.info("🔄 Migrated database user {} -> {}", oldReg, newReg);
            }
        }

        for (int i = 1; i <= 49; i++) {
            String newRegNo = String.format("CS%03d", i);

            if (!userRepository.existsByRegistrationNumber(newRegNo)) {
                User student = new User();
                student.setRegistrationNumber(newRegNo);
                student.setName("Student " + newRegNo);
                student.setEmail("student" + newRegNo.toLowerCase() + "@hackhub.dept.edu");
                student.setPasswordHash(defaultPassHash);
                student.setRole("ROLE_STUDENT");
                student.setStatus("ACTIVE");
                student.setSkills(sampleSkillsList.get(i % sampleSkillsList.size()));
                student.setFirstLogin(true);
                userRepository.save(student);
                countSeeded++;
            }
        }

        if (countSeeded > 0) {
            logger.info("✅ Seeded {} initial student accounts (CS001 to CS049) with default password '123'.", countSeeded);
        }

        // 3. Seed Sample Department Hackathons & Events if empty
        if (eventRepository.count() == 0) {
            User creator = userRepository.findByRegistrationNumber("CS001").orElse(null);
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
