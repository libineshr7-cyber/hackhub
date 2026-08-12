package com.hackhub.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class MailService {

    private static final Logger logger = LoggerFactory.getLogger(MailService.class);

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    public void sendOtpEmail(String toEmail, String registrationNumber, String otp) {
        String subject = "HackHub — Password Reset OTP Code";
        String content = "Hello Student (Reg No: " + registrationNumber + "),\n\n" +
                "Your one-time password (OTP) for resetting your HackHub account password is:\n\n" +
                "   >>> " + otp + " <<<\n\n" +
                "This OTP is valid for 5 minutes. Do not share this code with anyone.\n\n" +
                "Best regards,\n" +
                "HackHub Department Platform Team";

        logger.info("==================================================");
        logger.info("[GMAIL SMTP OTP] To: {} | RegNo: {} | OTP Code: {}", toEmail, registrationNumber, otp);
        logger.info("==================================================");

        if (mailSender != null && mailUsername != null && !mailUsername.trim().isEmpty()) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(mailUsername);
                message.setTo(toEmail);
                message.setSubject(subject);
                message.setText(content);
                mailSender.send(message);
                logger.info("Gmail SMTP OTP successfully dispatched to {}", toEmail);
            } catch (Exception e) {
                logger.error("Failed to dispatch email via Gmail SMTP. Exception details: ", e);
            }
        } else {
            logger.info("Gmail SMTP credentials not configured in environment variables. OTP code logged for developer reference.");
        }
    }
}
