package com.hackhub.service;

import com.hackhub.entity.Event;
import com.hackhub.repository.EventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class NotificationScheduler {

    private static final Logger logger = LoggerFactory.getLogger(NotificationScheduler.class);

    @Autowired
    private EventRepository eventRepository;

    /**
     * Periodically check for registration deadlines expiring soon (within 2 days)
     */
    @Scheduled(initialDelay = 10000, fixedRate = 3600000) // Runs every hour
    public void checkRegistrationDeadlines() {
        LocalDate today = LocalDate.now();
        LocalDate inTwoDays = today.plusDays(2);

        List<Event> expiringSoon = eventRepository.findByRegistrationDeadlineBetweenOrderByRegistrationDeadlineAsc(today, inTwoDays);
        if (!expiringSoon.isEmpty()) {
            logger.info("==================================================");
            logger.info("⏰ [DEADLINE REMINDER SYSTEM] {} events have registration deadlines closing soon:", expiringSoon.size());
            for (Event event : expiringSoon) {
                logger.info(" - Event: '{}' | Type: {} | Deadline: {}", event.getTitle(), event.getEventType(), event.getRegistrationDeadline());
            }
            logger.info("==================================================");
        }
    }
}
