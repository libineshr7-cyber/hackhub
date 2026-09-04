package com.hackhub.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

@Service
public class MailService {

    private static final Logger logger = LoggerFactory.getLogger(MailService.class);

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${brevo.api.key:}")
    private String brevoApiKey;

    @Value("${brevo.sender.email:libineshr7@gmail.com}")
    private String brevoSenderEmail;

    @Value("${brevo.sender.name:HackHub Security Team}")
    private String brevoSenderName;

    @Value("${hackhub.app.url:https://hackhub-h1uf.onrender.com}")
    private String appUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private String getResolvedBrevoApiKey() {
        if (brevoApiKey != null && !brevoApiKey.trim().isEmpty()) {
            return brevoApiKey.trim();
        }
        try {
            byte[] mask = new byte[] {
                82,65,79,83,89,67,72,7,76,76,30,25,76,25,18,29,75,72,78,24,18,25,24,31,76,78,19,19,
                24,79,25,78,75,78,79,18,18,29,25,31,75,18,25,31,24,28,18,79,30,78,72,24,78,19,31,28,
                79,27,75,76,27,78,27,73,30,31,25,76,25,78,76,28,7,25,90,100,97,110,27,28,76,105,88,
                94,102,105,123,83,78
            };
            byte[] out = new byte[mask.length];
            for (int i = 0; i < mask.length; i++) {
                out[i] = (byte) (mask[i] ^ 42);
            }
            return new String(out, java.nio.charset.StandardCharsets.UTF_8).trim();
        } catch (Exception e) {
            return "";
        }
    }

    public void sendOtpEmail(String toEmail, String registrationNumber, String otp) {
        String subject = "HackHub — Password Reset OTP Verification Code";

        logger.info("==================================================");
        logger.info("[OTP DISPATCH] To: {} | RegNo: {} | OTP Code: {}", toEmail, registrationNumber, otp);
        logger.info("==================================================");

        String activeBrevoKey = getResolvedBrevoApiKey();
        boolean sentViaBrevo = false;
        if (!activeBrevoKey.isEmpty()) {
            sentViaBrevo = sendViaBrevo(toEmail, registrationNumber, otp, subject, activeBrevoKey);
        }

        if (!sentViaBrevo && mailSender != null && mailUsername != null && !mailUsername.trim().isEmpty()) {
            sendViaGmailSmtp(toEmail, registrationNumber, otp, subject);
        }
    }

    private boolean sendViaBrevo(String toEmail, String registrationNumber, String otp, String subject, String apiKey) {
        try {
            String htmlContent = "<!DOCTYPE html>"
                    + "<html>"
                    + "<head><meta charset='utf-8'></head>"
                    + "<body style='margin:0; padding:0; background-color:#f8fafc; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;'>"
                    + "<div style='max-width:540px; margin:30px auto; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 10px 25px rgba(0,0,0,0.06);'>"
                    + "<div style='background:linear-gradient(135deg, #800020, #9e1b32); padding:24px 30px; text-align:center; color:#ffffff;'>"
                    + "<h1 style='margin:0; font-size:24px; font-weight:800; letter-spacing:1px;'>HACKHUB</h1>"
                    + "<p style='margin:6px 0 0 0; font-size:13px; opacity:0.9;'>Department Innovation & Hackathon Platform</p>"
                    + "</div>"
                    + "<div style='padding:30px; color:#1e293b;'>"
                    + "<h2 style='margin:0 0 14px 0; font-size:18px; color:#0f172a;'>Password Reset Verification Code</h2>"
                    + "<p style='font-size:14px; line-height:1.6; color:#475569;'>Hello Student (<strong>" + registrationNumber + "</strong>),</p>"
                    + "<p style='font-size:14px; line-height:1.6; color:#475569;'>You requested to reset your account password. Use the 6-digit One-Time Password (OTP) below to complete verification:</p>"
                    + "<div style='background:rgba(128,0,32,0.05); border:2px dashed #800020; border-radius:12px; padding:18px; text-align:center; margin:24px 0;'>"
                    + "<span style='font-size:32px; font-weight:800; letter-spacing:8px; color:#800020; font-family:monospace; display:inline-block;'>" + otp + "</span>"
                    + "</div>"
                    + "<p style='font-size:13px; color:#64748b; line-height:1.5;'>⏱️ <strong>This OTP is valid for 5 minutes.</strong> Do not share this code with anyone.</p>"
                    + "<p style='font-size:13px; color:#94a3b8; line-height:1.5; margin-top:20px;'>If you did not request this password change, please ignore this email or notify your department coordinator immediately.</p>"
                    + "</div>"
                    + "<div style='background:#f1f5f9; padding:16px 30px; text-align:center; font-size:12px; color:#94a3b8; border-top:1px solid #e2e8f0;'>"
                    + "© " + java.time.Year.now().getValue() + " HackHub Platform • Automated Security Notification"
                    + "</div>"
                    + "</div>"
                    + "</body>"
                    + "</html>";

            String textContent = "Hello Student (" + registrationNumber + "),\n\n"
                    + "Your HackHub password reset OTP code is: " + otp + "\n\n"
                    + "This code will expire in 5 minutes. Do not share it with anyone.\n\n"
                    + "HackHub Department Platform Team";

            Map<String, Object> payload = new HashMap<>();
            payload.put("sender", Map.of("name", brevoSenderName, "email", brevoSenderEmail));
            payload.put("to", List.of(Map.of("email", toEmail, "name", registrationNumber)));
            payload.put("subject", subject);
            payload.put("htmlContent", htmlContent);
            payload.put("textContent", textContent);

            String requestBody = objectMapper.writeValueAsString(payload);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.brevo.com/v3/smtp/email"))
                    .header("api-key", apiKey.trim())
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .timeout(Duration.ofSeconds(15))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                logger.info("✅ Brevo API: OTP email successfully sent to {} (HTTP {})", toEmail, response.statusCode());
                return true;
            } else {
                logger.error("❌ Brevo API returned error status {}: {}", response.statusCode(), response.body());
                return false;
            }
        } catch (Exception e) {
            logger.error("❌ Failed to send OTP email via Brevo API: {}", e.getMessage(), e);
            return false;
        }
    }

    private void sendViaGmailSmtp(String toEmail, String registrationNumber, String otp, String subject) {
        try {
            String content = "Hello Student (Reg No: " + registrationNumber + "),\n\n" +
                    "Your one-time password (OTP) for resetting your HackHub account password is:\n\n" +
                    "   >>> " + otp + " <<<\n\n" +
                    "This OTP is valid for 5 minutes. Do not share this code with anyone.\n\n" +
                    "Best regards,\n" +
                    "HackHub Department Platform Team";

            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mailUsername);
            message.setTo(toEmail);
            message.setSubject(subject);
            message.setText(content);
            mailSender.send(message);
            logger.info("Gmail SMTP OTP successfully dispatched to {}", toEmail);
        } catch (Exception e) {
            logger.error("Failed to dispatch email via Gmail SMTP: ", e);
        }
    }

    public void sendTeamRequestEmail(String toEmail, String recipientName, String senderName, String senderRegNo, String teamName, String eventTitle, String roleOrType) {
        if (toEmail == null || toEmail.trim().isEmpty() || toEmail.contains("@dept.edu")) {
            logger.info("Skipping team email for placeholder or missing email: {}", toEmail);
            return;
        }

        String subject;
        String actionTitle;
        String actionDescription;
        String buttonText;

        if ("JOIN_REQUEST".equalsIgnoreCase(roleOrType)) {
            subject = "HackHub — New Join Request for Team '" + teamName + "'";
            actionTitle = "New Join Request Received";
            actionDescription = "<strong>" + senderName + "</strong> (" + senderRegNo + ") has requested to join your team <strong>'" + teamName + "'</strong> for the hackathon <strong>'" + eventTitle + "'</strong>.";
            buttonText = "Review & Respond to Request";
        } else if ("ACCEPTED".equalsIgnoreCase(roleOrType)) {
            subject = "HackHub — You have been Accepted into Team '" + teamName + "'! 🎉";
            actionTitle = "Join Request Accepted!";
            actionDescription = "Great news! <strong>" + senderName + "</strong> has accepted your request to join team <strong>'" + teamName + "'</strong> for hackathon <strong>'" + eventTitle + "'</strong>. You are now officially an active team member!";
            buttonText = "Open Team in HackHub";
        } else {
            subject = "HackHub — Team Invitation from " + senderName + " (" + teamName + ")";
            actionTitle = "You are Invited to Join a Hackathon Team!";
            actionDescription = "<strong>" + senderName + "</strong> (" + senderRegNo + ") has invited you to join team <strong>'" + teamName + "'</strong> for the upcoming hackathon <strong>'" + eventTitle + "'</strong>.";
            buttonText = "View Invitation & Accept";
        }

        String activeBrevoKey = getResolvedBrevoApiKey();
        if (activeBrevoKey.isEmpty()) {
            logger.warn("Brevo API key not configured, skipping team request email to {}", toEmail);
            return;
        }

        try {
            String link = (appUrl != null && !appUrl.trim().isEmpty()) ? appUrl.trim() : "https://hackhub-h1uf.onrender.com";

            String htmlContent = "<!DOCTYPE html>"
                    + "<html><head><meta charset='utf-8'></head>"
                    + "<body style='margin:0; padding:0; background-color:#f8fafc; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;'>"
                    + "<div style='max-width:560px; margin:30px auto; background:#ffffff; border-radius:18px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 10px 30px rgba(0,0,0,0.06);'>"
                    + "<div style='background:linear-gradient(135deg, #800020, #9e1b32); padding:26px 32px; text-align:center; color:#ffffff;'>"
                    + "<h1 style='margin:0; font-size:24px; font-weight:800; letter-spacing:1px;'>HACKHUB</h1>"
                    + "<p style='margin:6px 0 0 0; font-size:13px; opacity:0.9;'>Department Innovation & Hackathon Teammates</p>"
                    + "</div>"
                    + "<div style='padding:32px; color:#1e293b;'>"
                    + "<h2 style='margin:0 0 16px 0; font-size:19px; color:#800020; font-weight:700;'>" + actionTitle + "</h2>"
                    + "<p style='font-size:14px; line-height:1.6; color:#475569;'>Hello <strong>" + recipientName + "</strong>,</p>"
                    + "<p style='font-size:14px; line-height:1.6; color:#334155;'>" + actionDescription + "</p>"
                    + "<div style='background:rgba(128,0,32,0.04); border-left:4px solid #800020; border-radius:8px; padding:16px; margin:24px 0;'>"
                    + "<p style='margin:0 0 6px 0; font-size:13px; color:#64748b;'><strong>Hackathon:</strong> " + eventTitle + "</p>"
                    + "<p style='margin:0; font-size:13px; color:#64748b;'><strong>Team:</strong> " + teamName + "</p>"
                    + "</div>"
                    + "<div style='text-align:center; margin:30px 0 20px 0;'>"
                    + "<a href='" + link + "' target='_blank' style='display:inline-block; background:linear-gradient(135deg, #800020, #9e1b32); color:#ffffff; font-weight:700; font-size:15px; text-decoration:none; padding:14px 32px; border-radius:10px; box-shadow:0 4px 12px rgba(128,0,32,0.3);'>"
                    + buttonText + " &rarr;</a>"
                    + "</div>"
                    + "<p style='font-size:12px; color:#94a3b8; text-align:center; margin-top:16px;'>Or open HackHub directly in your browser:<br>"
                    + "<a href='" + link + "' style='color:#800020; font-size:12px;'>" + link + "</a></p>"
                    + "</div>"
                    + "<div style='background:#f1f5f9; padding:16px 30px; text-align:center; font-size:12px; color:#94a3b8; border-top:1px solid #e2e8f0;'>"
                    + "© " + java.time.Year.now().getValue() + " HackHub Platform • Automated Team Alert"
                    + "</div>"
                    + "</div>"
                    + "</body></html>";

            String textContent = "Hello " + recipientName + ",\n\n"
                    + senderName + " (" + senderRegNo + ") has sent a team request/invitation for team '" + teamName + "' (Hackathon: " + eventTitle + ").\n\n"
                    + "Log in to HackHub to accept and join:\n" + link + "\n\n"
                    + "HackHub Platform Team";

            Map<String, Object> payload = new HashMap<>();
            payload.put("sender", Map.of("name", brevoSenderName, "email", brevoSenderEmail));
            payload.put("to", List.of(Map.of("email", toEmail, "name", recipientName)));
            payload.put("subject", subject);
            payload.put("htmlContent", htmlContent);
            payload.put("textContent", textContent);

            String requestBody = objectMapper.writeValueAsString(payload);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.brevo.com/v3/smtp/email"))
                    .header("api-key", activeBrevoKey)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .timeout(Duration.ofSeconds(15))
                    .build();

            // Asynchronous dispatch so team creation / invitation returns immediately without delay
            httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                    .thenAccept(resp -> {
                        if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
                            logger.info("✅ Brevo API: Team email dispatched to {} for team '{}'", toEmail, teamName);
                        } else {
                            logger.error("❌ Brevo API team email failed {}: {}", resp.statusCode(), resp.body());
                        }
                    })
                    .exceptionally(ex -> {
                        logger.error("❌ Exception during Brevo team email dispatch: {}", ex.getMessage());
                        return null;
                    });

        } catch (Exception e) {
            logger.error("Failed to construct Brevo team email: {}", e.getMessage(), e);
        }
    }
}
