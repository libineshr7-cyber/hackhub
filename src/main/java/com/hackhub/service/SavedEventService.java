package com.hackhub.service;

import com.hackhub.dto.AuthDtos.ApiResponse;
import com.hackhub.dto.EventDto;
import com.hackhub.entity.Event;
import com.hackhub.entity.SavedEvent;
import com.hackhub.entity.User;
import com.hackhub.repository.EventRepository;
import com.hackhub.repository.SavedEventRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class SavedEventService {

    @Autowired
    private SavedEventRepository savedEventRepository;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private EventService eventService;

    @Transactional
    public ApiResponse saveEvent(Long eventId, User user) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("Event not found with ID: " + eventId));

        if (savedEventRepository.existsByUserAndEvent(user, event)) {
            return new ApiResponse(true, "Event is already saved.");
        }

        SavedEvent savedEvent = new SavedEvent(user, event);
        savedEventRepository.save(savedEvent);
        return new ApiResponse(true, "Event saved successfully.");
    }

    @Transactional
    public ApiResponse unsaveEvent(Long eventId, User user) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("Event not found with ID: " + eventId));

        savedEventRepository.deleteByUserAndEvent(user, event);
        return new ApiResponse(true, "Event removed from saved list.");
    }

    public List<EventDto> getSavedEvents(User user) {
        List<SavedEvent> savedList = savedEventRepository.findByUserOrderByCreatedAtDesc(user);
        return savedList.stream()
                .map(s -> eventService.mapToDto(s.getEvent(), user))
                .collect(Collectors.toList());
    }
}
