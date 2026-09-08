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

        // 3. Clean up legacy dummy department events if present
        List<String> dummyLinks = Arrays.asList(
                "https://cyberhack2026.dept.edu/register",
                "https://ai-challenge.dept.edu",
                "https://hacksprint2026.dept.edu"
        );
        for (String dummyLink : dummyLinks) {
            try {
                eventRepository.findByRegistrationLink(dummyLink).ifPresent(eventRepository::delete);
            } catch (Exception ignored) {}
        }

        // 4. Ensure real, authentic national and global hackathons always exist
        LocalDate today = LocalDate.now();
        User creator = userRepository.findByRegistrationNumber("Admin").orElse(null);
        if (creator == null) {
            creator = userRepository.findAll().stream().findFirst().orElse(null);
        }

        seedOrUpdateRealEvent(
                "Smart India Hackathon (SIH) 2026",
                "World's largest open innovation model by Ministry of Education & AICTE. Compete across 36-hour non-stop problem-solving for Central Ministries, State Governments, and PSUs. Software and Hardware editions.",
                "HACKATHON",
                6, 6,
                today.plusDays(25), today.plusDays(27), today.plusDays(18),
                "HYBRID",
                "National Nodal Centers & sih.gov.in",
                "https://sih.gov.in",
                "Python, AI/ML, Full Stack, IoT, Mobile Apps, System Design",
                "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80",
                creator
        );

        seedOrUpdateRealEvent(
                "Google Solution Challenge 2026",
                "Global annual hackathon by Google for Developers. Build solutions addressing one or more of the 17 United Nations Sustainable Development Goals using Flutter, Firebase, TensorFlow, and Google Cloud.",
                "HACKATHON",
                1, 4,
                today.plusDays(15), today.plusDays(17), today.plusDays(10),
                "ONLINE",
                "Google for Developers Community",
                "https://developers.google.com/community/gdsc-solution-challenge",
                "Flutter, Firebase, Google Cloud, AI/ML, React, Android",
                "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80",
                creator
        );

        seedOrUpdateRealEvent(
                "Flipkart GRiD 6.0 — Software Development Challenge",
                "Flipkart's premier campus hackathon for engineering students across India. Solve real-world e-commerce challenges across GenAI, High-Throughput Systems, Distributed Architecture, and Robotics.",
                "HACKATHON",
                2, 3,
                today.plusDays(8), today.plusDays(10), today.plusDays(3),
                "ONLINE",
                "Unstop & Flipkart HQ",
                "https://unstop.com/hackathons/flipkart-grid-60-software-development-track-flipkart-984478",
                "Java, Python, Algorithms, Distributed Systems, Cloud",
                "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80",
                creator
        );

        seedOrUpdateRealEvent(
                "Microsoft Imagine Cup 2026",
                "The premier global student technology competition. Build game-changing solutions using Microsoft Azure, GitHub, and OpenAI with mentorship from Microsoft leaders and $100,000 in grand prizes.",
                "COMPETITION",
                1, 4,
                today.plusDays(30), today.plusDays(32), today.plusDays(22),
                "ONLINE",
                "Microsoft Virtual Campus",
                "https://imaginecup.microsoft.com",
                "Azure, OpenAI, Python, Full Stack, UI/UX, Cloud",
                "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
                creator
        );

        seedOrUpdateRealEvent(
                "Kavach 2026 — National Cyber Security Hackathon",
                "National cyber security initiative by AICTE, MoE's Innovation Cell, and Bureau of Police Research & Development (BPR&D) to identify cyber defense prototypes, dark web scrapers, and zero-trust systems.",
                "HACKATHON",
                3, 6,
                today.plusDays(12), today.plusDays(14), today.plusDays(6),
                "HYBRID",
                "AICTE Headquarters & BPR&D Centers",
                "https://kavach.mic.gov.in",
                "Cybersecurity, Threat Hunting, Python, CTF, Networking, Cryptography",
                "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80",
                creator
        );

        seedOrUpdateRealEvent(
                "Tata Imagination Challenge 2026",
                "One of India's largest campus ideation and leadership competitions by Tata Sons. Present innovative ideas for real-world enterprise disruption, green tech, and societal transformation directly to Tata leaders.",
                "COMPETITION",
                1, 3,
                today.plusDays(5), today.plusDays(6), today.plusDays(2),
                "ONLINE",
                "Tata Sons & Unstop",
                "https://unstop.com/competitions/tata-imagination-challenge-2026",
                "Ideation, Product Design, Presentation, Innovation",
                "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80",
                creator
        );

        logger.info("✅ Ensured real national and global hackathons (SIH 2026, Google, Flipkart, Microsoft, Kavach, Tata) are active.");
        logger.info("==================================================");
    }

    private void seedOrUpdateRealEvent(
            String title,
            String description,
            String eventType,
            int minTeam,
            int maxTeam,
            LocalDate startDate,
            LocalDate endDate,
            LocalDate deadline,
            String mode,
            String venue,
            String registrationLink,
            String skills,
            String posterPath,
            User creator) {
        try {
            Event event = eventRepository.findByRegistrationLink(registrationLink)
                    .orElseGet(() -> eventRepository.findAll().stream()
                            .filter(e -> e.getTitle() != null && e.getTitle().equalsIgnoreCase(title))
                            .findFirst()
                            .orElse(new Event()));

            event.setTitle(title);
            event.setDescription(description);
            event.setEventType(eventType);
            event.setTeamSizeMin(minTeam);
            event.setTeamSizeMax(maxTeam);
            event.setStartDate(startDate);
            event.setEndDate(endDate);
            event.setRegistrationDeadline(deadline);
            event.setMode(mode);
            event.setVenue(venue);
            event.setRegistrationLink(registrationLink);
            event.setSkills(skills);
            event.setPosterPath(posterPath);
            if (event.getCreatedBy() == null) {
                event.setCreatedBy(creator);
            }
            eventRepository.save(event);
        } catch (Exception e) {
            logger.warn("⚠️ Could not seed/update event {}: {}", title, e.getMessage());
        }
    }
}
