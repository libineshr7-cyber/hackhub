-- ============================================================
-- HackHub Database Migration Script
-- Run this ONCE on your MySQL database:
--   1. Rename CS001-CS049 → CS2001-CS2049
--   2. Insert Admin user (username: Admin, password: Admin@123)
--   3. Insert CS3001-CS3048 new students
-- ============================================================

-- Step 1: Add 'department' column if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(20) DEFAULT 'CS';

-- Step 2: Set department for existing CS students
UPDATE users SET department = 'CS' WHERE department IS NULL OR department = '';

-- Step 3: Rename CS001-CS049 → CS2001-CS2049 (preserving all data)
UPDATE users SET registration_number = CONCAT('CS2', LPAD(SUBSTRING(registration_number, 3), 3, '0'))
WHERE registration_number REGEXP '^CS0[0-4][0-9]$' OR registration_number REGEXP '^CS0[0-9]$';

-- Alternative safer rename (handles CS001 -> CS2001, CS049 -> CS2049):
-- UPDATE users SET registration_number = REPLACE(registration_number, 'CS0', 'CS20') WHERE registration_number LIKE 'CS0%' AND CHAR_LENGTH(registration_number) = 5;

-- Step 4: Insert Admin user (password hash for 'Admin@123' — update the hash as needed)
-- Default password: Admin@123 (BCrypt hash generated separately)
-- You can change this password from the admin panel after first login
INSERT IGNORE INTO users (registration_number, name, email, password_hash, role, status, first_login, department, created_at, updated_at)
VALUES (
    'Admin',
    'Department Admin',
    'admin@hackhub.dept.edu',
    '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy', -- BCrypt hash of 'Admin@123'
    'ROLE_ADMIN',
    'ACTIVE',
    0,
    'CS',
    NOW(),
    NOW()
);

-- Step 5: Insert CS3001-CS3048 (3rd year students)
INSERT IGNORE INTO users (registration_number, name, email, password_hash, role, status, first_login, department, skills, created_at, updated_at) VALUES
('CS3001','Student CS3001','studentcs3001@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3002','Student CS3002','studentcs3002@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3003','Student CS3003','studentcs3003@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3004','Student CS3004','studentcs3004@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3005','Student CS3005','studentcs3005@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3006','Student CS3006','studentcs3006@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3007','Student CS3007','studentcs3007@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3008','Student CS3008','studentcs3008@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3009','Student CS3009','studentcs3009@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3010','Student CS3010','studentcs3010@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3011','Student CS3011','studentcs3011@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3012','Student CS3012','studentcs3012@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3013','Student CS3013','studentcs3013@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3014','Student CS3014','studentcs3014@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3015','Student CS3015','studentcs3015@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3016','Student CS3016','studentcs3016@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3017','Student CS3017','studentcs3017@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3018','Student CS3018','studentcs3018@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3019','Student CS3019','studentcs3019@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3020','Student CS3020','studentcs3020@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3021','Student CS3021','studentcs3021@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3022','Student CS3022','studentcs3022@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3023','Student CS3023','studentcs3023@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3024','Student CS3024','studentcs3024@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3025','Student CS3025','studentcs3025@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3026','Student CS3026','studentcs3026@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3027','Student CS3027','studentcs3027@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3028','Student CS3028','studentcs3028@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3029','Student CS3029','studentcs3029@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3030','Student CS3030','studentcs3030@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3031','Student CS3031','studentcs3031@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3032','Student CS3032','studentcs3032@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3033','Student CS3033','studentcs3033@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3034','Student CS3034','studentcs3034@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3035','Student CS3035','studentcs3035@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3036','Student CS3036','studentcs3036@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3037','Student CS3037','studentcs3037@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3038','Student CS3038','studentcs3038@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3039','Student CS3039','studentcs3039@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3040','Student CS3040','studentcs3040@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3041','Student CS3041','studentcs3041@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3042','Student CS3042','studentcs3042@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3043','Student CS3043','studentcs3043@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3044','Student CS3044','studentcs3044@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3045','Student CS3045','studentcs3045@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3046','Student CS3046','studentcs3046@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3047','Student CS3047','studentcs3047@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW()),
('CS3048','Student CS3048','studentcs3048@hackhub.dept.edu','$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBpwTmVl9.b2hy','ROLE_STUDENT','ACTIVE',1,'CS','Python, Java',NOW(),NOW());

-- Note: The BCrypt hash above is for password '123'
-- To change Admin password, login as Admin with 'Admin@123' via first-login change, OR
-- you can update it after application startup using the admin reset feature.

-- Verify counts:
-- SELECT COUNT(*) FROM users WHERE role = 'ROLE_STUDENT' AND registration_number LIKE 'CS2%'; -- should be 49
-- SELECT COUNT(*) FROM users WHERE role = 'ROLE_STUDENT' AND registration_number LIKE 'CS3%'; -- should be 48
-- SELECT * FROM users WHERE role = 'ROLE_ADMIN';
