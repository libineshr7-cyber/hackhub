package com.hackhub.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hackhub.dto.AuthDtos.ApiResponse;
import com.hackhub.dto.EventDto;
import com.hackhub.entity.User;
import com.hackhub.repository.UserRepository;
import com.hackhub.service.EventService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/events")
public class EventController {

    @Autowired
    private EventService eventService;

    @Autowired
    private com.hackhub.service.UnstopSyncService unstopSyncService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private User getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        return userRepository.findByRegistrationNumber(authentication.getName()).orElse(null);
    }

    @PostMapping(consumes = { MediaType.MULTIPART_FORM_DATA_VALUE })
    public ResponseEntity<?> createEventWithPoster(
            @RequestPart("event") String eventJson,
            @RequestPart(value = "poster", required = false) MultipartFile posterFile,
            Authentication authentication) {
        User currentUser = getCurrentUser(authentication);
        if (currentUser == null) {
            return ResponseEntity.status(401).body(new ApiResponse(false, "Authentication required to post events."));
        }
        try {
            EventDto dto = objectMapper.readValue(eventJson, EventDto.class);
            EventDto result = eventService.createEvent(dto, posterFile, currentUser);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ApiResponse(false, "Failed to publish event: " + e.getMessage()));
        }
    }

    @PostMapping(consumes = { MediaType.APPLICATION_JSON_VALUE })
    public ResponseEntity<?> createEventJson(@RequestBody EventDto dto, Authentication authentication) {
        User currentUser = getCurrentUser(authentication);
        if (currentUser == null) {
            return ResponseEntity.status(401).body(new ApiResponse(false, "Authentication required to post events."));
        }
        try {
            EventDto result = eventService.createEvent(dto, null, currentUser);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<List<EventDto>> getAllEvents(Authentication authentication) {
        User currentUser = getCurrentUser(authentication);
        return ResponseEntity.ok(eventService.getAllEventsForCalendar(currentUser));
    }

    @GetMapping("/upcoming")
    public ResponseEntity<List<EventDto>> getUpcomingEvents(Authentication authentication) {
        User currentUser = getCurrentUser(authentication);
        return ResponseEntity.ok(eventService.getUpcomingEvents(currentUser));
    }

    @GetMapping("/ended")
    public ResponseEntity<List<EventDto>> getEndedEvents(Authentication authentication) {
        User currentUser = getCurrentUser(authentication);
        return ResponseEntity.ok(eventService.getEndedEvents(currentUser));
    }

    @GetMapping("/deadline-soon")
    public ResponseEntity<List<EventDto>> getDeadlineSoonEvents(Authentication authentication) {
        User currentUser = getCurrentUser(authentication);
        return ResponseEntity.ok(eventService.getDeadlineSoonEvents(currentUser));
    }

    @GetMapping("/latest")
    public ResponseEntity<List<EventDto>> getLatestEvents(Authentication authentication) {
        User currentUser = getCurrentUser(authentication);
        return ResponseEntity.ok(eventService.getLatestEvents(currentUser));
    }

    @GetMapping("/calendar")
    public ResponseEntity<List<EventDto>> getCalendarEvents(Authentication authentication) {
        User currentUser = getCurrentUser(authentication);
        return ResponseEntity.ok(eventService.getAllEventsForCalendar(currentUser));
    }

    @GetMapping("/search")
    public ResponseEntity<List<EventDto>> searchEvents(
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "eventType", required = false) String eventType,
            @RequestParam(value = "mode", required = false) String mode,
            @RequestParam(value = "view", required = false) String view,
            Authentication authentication) {
        User currentUser = getCurrentUser(authentication);
        return ResponseEntity.ok(eventService.searchEvents(query, eventType, mode, view, currentUser));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getEventDetails(@PathVariable("id") Long id, Authentication authentication) {
        User currentUser = getCurrentUser(authentication);
        try {
            EventDto dto = eventService.getEventDetails(id, currentUser);
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @PostMapping("/sync-unstop")
    public ResponseEntity<?> syncUnstopEvents() {
        try {
            int count = unstopSyncService.fetchAndSyncUnstopHackathons();
            return ResponseEntity.ok(new ApiResponse(true, "Successfully synced " + count + " live hackathons from Unstop!"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ApiResponse(false, "Unstop sync failed: " + e.getMessage()));
        }
    }

    @DeleteMapping("/clear-unstop")
    public ResponseEntity<?> clearUnstopEvents() {
        try {
            int count = unstopSyncService.clearUnstopEvents();
            return ResponseEntity.ok(new ApiResponse(true, "Cleared " + count + " Unstop events from database."));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ApiResponse(false, "Failed to clear Unstop events: " + e.getMessage()));
        }
    }
}
