# HackHub — Department Hackathon & Event Platform

**HackHub** is a mobile-first, department-only platform built specifically for students to discover hackathons, post events instantly, find teammates using skill matching, track registration deadlines, bookmark saved events, view interactive calendars, and report problematic events.

---

## 🌟 Main Features & USP

- **Find Team (Main USP)**: Allows students to create teams for any hackathon/event, view teammate skills, calculate skill-matching percentages, send join requests, and manage team members.
- **Immediate Event Posting**: Authenticated department students can post events with poster uploads—published instantly without admin approval bottlenecks.
- **Automatic Event Status**: Events automatically transition between `UPCOMING`, `DEADLINE_SOON`, and `ENDED` based on current server date.
- **Gmail SMTP OTP Password Recovery**: Secure 6-digit one-time password flow sent to the student's registered email address for forgotten passwords.
- **Protected Admin Dashboard**: Complete oversight of total students, events, saved items, report audit logs, student account creation (001–149 and 150+ expansion), account activation toggles, and secure administrative password resets.
- **Mobile-First Responsive SPA**: Glassmorphic dark cyber aesthetic with sticky bottom navigation on mobile devices and top navbar on desktop.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3 (Vanilla CSS with CSS Custom Properties & Glassmorphism), Vanilla JavaScript.
- **Backend**: Java 21, Spring Boot 3.2.5, Spring Web, Spring Data JPA, Spring Security, JavaMail.
- **Security**: BCrypt Password Hashing, JWT Authentication Filter, Role-Based Access Control (`ROLE_STUDENT`, `ROLE_ADMIN`).
- **Database**: MySQL Server 8.x (with automated DDL schema management).
- **Email**: Gmail SMTP via JavaMailSender.
- **Build Tool**: Apache Maven.

---

## 📁 Recommended Architecture

```text
com.hackhub
│
├── config              # Web MVC resource handlers & CORS configuration
├── controller          # Auth, Event, Team, SavedEvent, Report, Admin controllers
├── dto                 # Request and Response Data Transfer Objects
├── entity              # User, Event, Team, TeamMember, TeamRequest, SavedEvent, Report, OtpRequest JPA entities
├── exception           # Global REST Exception Handler
├── repository          # Spring Data JPA repositories
├── security            # Spring Security, JwtUtils, JwtAuthFilter, UserDetailsService
├── service             # Auth, Event, Team, SavedEvent, Report, Admin, Mail, FileStorage, Scheduler services
└── util                # DataInitializer for seeding 001-149 student accounts
```

---

## ⚙️ Environment Variables & Configuration

Set the following environment variables (or rely on sensible local defaults):

| Variable | Description | Default Value |
| :--- | :--- | :--- |
| `DB_URL` | MySQL JDBC Connection URL | `jdbc:mysql://localhost:3306/hackhub_db?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true` |
| `DB_USERNAME` | MySQL Username | `root` |
| `DB_PASSWORD` | MySQL Password | `""` |
| `MAIL_HOST` | SMTP Host | `smtp.gmail.com` |
| `MAIL_PORT` | SMTP Port | `587` |
| `MAIL_USERNAME` | Gmail Account Email | `""` |
| `MAIL_PASSWORD` | Gmail App Password (16-char) | `""` |
| `JWT_SECRET` | 256-bit Secret Key | Configured in properties |

> [!NOTE]
> If Gmail SMTP credentials are not supplied, the system logs the 6-digit OTP code to the backend server console for local testing without interrupting password recovery tests.

---

## 🚀 Running the Project

### 1. Database Setup
Make sure MySQL Server is running on `localhost:3306`. The database `hackhub_db` will be created automatically on first startup.

### 2. Build & Run Backend
Compile and start the Spring Boot application using Maven:

```bash
mvn clean package
java -jar target/hackhub-1.0.0.jar
```

Alternatively, run directly:

```bash
mvn spring-boot:run
```

### 3. Accessing the Web Application
Open your web browser and navigate to:
```text
http://localhost:8080
```

---

## 🔑 Account Access & Security Architecture

### Department Student Accounts
- **Registration Formats**: `CS2001`–`CS2049` (2nd Year), `CS3001`–`CS3048` (3rd Year).
- **First Login Behavior**: Automatically prompted to establish a secure password upon initial access.

### Department Administration
- **Role Hierarchy**: System Administrator (`ROLE_ADMIN`) and Department Sub-Administrators (`ROLE_SUBADMIN`).
- **Access Control**: Role-based access control with granular department and year-level permission scoping.

---

## 🛡️ Security Notes

- Passwords are strictly hashed using **BCrypt** with salted work factors.
- File uploads are validated for MIME type (`image/jpeg`, `image/png`, `image/webp`), size (<5MB), and sanitized with random UUID filenames.
- Admin routes (`/api/admin/**`) are protected by Spring Security method security and role verification (`ROLE_ADMIN`, `ROLE_SUBADMIN`).
- Secrets and sensitive environment configurations are excluded via `.gitignore`.
