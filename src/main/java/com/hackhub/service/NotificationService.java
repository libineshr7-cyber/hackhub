package com.hackhub.service;

import com.hackhub.dto.NotificationDto;
import com.hackhub.entity.Notification;
import com.hackhub.entity.User;
import com.hackhub.repository.NotificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    @Autowired
    private NotificationRepository notificationRepository;

    @Transactional
    public void createNotification(User recipient, User sender, String title, String message, String type, String link) {
        if (recipient == null) return;
        Notification notification = new Notification(recipient, sender, title, message, type, link);
        notificationRepository.save(notification);
    }

    public List<NotificationDto> getUserNotifications(User recipient) {
        List<Notification> notifications = notificationRepository.findByRecipientOrderByCreatedAtDesc(recipient);
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");
        return notifications.stream().map(n -> {
            NotificationDto dto = new NotificationDto();
            dto.setId(n.getId());
            dto.setTitle(n.getTitle());
            dto.setMessage(n.getMessage());
            dto.setType(n.getType());
            dto.setLink(n.getLink());
            dto.setRead(n.isRead());
            if (n.getSender() != null) {
                dto.setSenderName(n.getSender().getName());
                dto.setSenderRegNo(n.getSender().getRegistrationNumber());
            }
            if (n.getCreatedAt() != null) {
                dto.setCreatedAt(n.getCreatedAt().format(formatter));
            }
            return dto;
        }).collect(Collectors.toList());
    }

    public long getUnreadCount(User recipient) {
        return notificationRepository.countByRecipientAndIsReadFalse(recipient);
    }

    @Transactional
    public void markAllAsRead(User recipient) {
        List<Notification> notifications = notificationRepository.findByRecipientOrderByCreatedAtDesc(recipient);
        for (Notification n : notifications) {
            if (!n.isRead()) {
                n.setRead(true);
                notificationRepository.save(n);
            }
        }
    }

    @Transactional
    public void clearAllNotifications(User recipient) {
        notificationRepository.deleteByRecipient(recipient);
    }
}
