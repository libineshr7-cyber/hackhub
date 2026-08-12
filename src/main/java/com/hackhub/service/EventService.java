package com.hackhub.service;

import com.hackhub.dto.EventDto;
import com.hackhub.entity.Event;
import com.hackhub.entity.Team;
import com.hackhub.entity.User;
import com.hackhub.repository.EventRepository;
import com.hackhub.repository.SavedEventRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import com.hackhub.repository.*;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class EventService {

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private SavedEventRepository savedEventRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private TeamMemberRepository teamMemberRepository;

    @Autowired
    private TeamRequestRepository teamRequestRepository;

    @Autowired
    private FileStorageService fileStorageService;

    @Transactional
    public EventDto createEvent(EventDto dto, MultipartFile posterFile, User creator) {
        if (dto.getTitle() == null || dto.getTitle().trim().isEmpty()) {
            throw new IllegalArgumentException("Event title is required.");
        }
        if (dto.getStartDate() == null || dto.getEndDate() == null || dto.getRegistrationDeadline() == null) {
            throw new IllegalArgumentException("Start date, end date, and registration deadline are required.");
        }
        if (dto.getEndDate().isBefore(dto.getStartDate())) {
            throw new IllegalArgumentException("End date cannot be before start date.");
        }
        if (dto.getRegistrationDeadline().isAfter(dto.getEndDate())) {
            throw new IllegalArgumentException("Registration deadline cannot be after event end date.");
        }

        Event event = new Event();
        event.setTitle(dto.getTitle().trim());
        event.setDescription(dto.getDescription());
        event.setEventType(dto.getEventType() != null ? dto.getEventType() : "HACKATHON");
        event.setTeamSizeMin(dto.getTeamSizeMin() != null ? dto.getTeamSizeMin() : 1);
        event.setTeamSizeMax(dto.getTeamSizeMax() != null ? dto.getTeamSizeMax() : 4);
        event.setStartDate(dto.getStartDate());
        event.setEndDate(dto.getEndDate());
        event.setRegistrationDeadline(dto.getRegistrationDeadline());
        event.setMode(dto.getMode() != null ? dto.getMode() : "HYBRID");
        event.setVenue(dto.getVenue());
        event.setRegistrationLink(dto.getRegistrationLink());
        event.setSkills(dto.getSkills());
        event.setCreatedBy(creator);

        if (posterFile != null && !posterFile.isEmpty()) {
            String posterUrl = fileStorageService.storeFile(posterFile);
            event.setPosterPath(posterUrl);
        } else if (dto.getPosterPath() != null && !dto.getPosterPath().trim().isEmpty()) {
            event.setPosterPath(dto.getPosterPath());
        }

        Event saved = eventRepository.save(event);
        return mapToDto(saved, creator);
    }

    public List<EventDto> getUpcomingEvents(User user) {
        LocalDate today = LocalDate.now();
        List<Event> events = eventRepository.findByEndDateGreaterThanEqualOrderByStartDateAsc(today);
        return events.stream().map(e -> mapToDto(e, user)).collect(Collectors.toList());
    }

    public List<EventDto> getEndedEvents(User user) {
        LocalDate today = LocalDate.now();
        List<Event> events = eventRepository.findByEndDateLessThanOrderByEndDateDesc(today);
        return events.stream().map(e -> mapToDto(e, user)).collect(Collectors.toList());
    }

    public List<EventDto> getDeadlineSoonEvents(User user) {
        LocalDate today = LocalDate.now();
        LocalDate inFiveDays = today.plusDays(5);
        List<Event> events = eventRepository.findByRegistrationDeadlineBetweenOrderByRegistrationDeadlineAsc(today, inFiveDays);
        return events.stream()
                .filter(e -> !e.getEndDate().isBefore(today))
                .map(e -> mapToDto(e, user))
                .collect(Collectors.toList());
    }

    public List<EventDto> searchEvents(String query, String eventType, String mode, User user) {
        List<Event> events = eventRepository.searchEvents(
                (query != null && !query.trim().isEmpty()) ? query.trim() : null,
                (eventType != null && !eventType.trim().isEmpty() && !"ALL".equalsIgnoreCase(eventType)) ? eventType.trim() : null,
                (mode != null && !mode.trim().isEmpty() && !"ALL".equalsIgnoreCase(mode)) ? mode.trim() : null
        );
        return events.stream().map(e -> mapToDto(e, user)).collect(Collectors.toList());
    }

    public EventDto getEventDetails(Long eventId, User user) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("Event not found with ID: " + eventId));
        return mapToDto(event, user);
    }

    public List<EventDto> getAllEventsForCalendar(User user) {
        List<Event> events = eventRepository.findAll();
        return events.stream().map(e -> mapToDto(e, user)).collect(Collectors.toList());
    }

    public EventDto mapToDto(Event event, User user) {
        LocalDate today = LocalDate.now();
        EventDto dto = new EventDto();
        dto.setId(event.getId());
        dto.setTitle(event.getTitle());
        dto.setDescription(event.getDescription());
        dto.setEventType(event.getEventType());
        dto.setTeamSizeMin(event.getTeamSizeMin());
        dto.setTeamSizeMax(event.getTeamSizeMax());
        dto.setStartDate(event.getStartDate());
        dto.setEndDate(event.getEndDate());
        dto.setRegistrationDeadline(event.getRegistrationDeadline());
        dto.setPosterPath(event.getPosterPath());
        dto.setRegistrationLink(event.getRegistrationLink());
        dto.setMode(event.getMode());
        dto.setVenue(event.getVenue());
        dto.setSkills(event.getSkills());

        if (event.getCreatedBy() != null) {
            dto.setCreatedByRegNo(event.getCreatedBy().getRegistrationNumber());
            dto.setCreatedByName(event.getCreatedBy().getName());
        }

        // Calculate dynamic status based on date
        if (today.isAfter(event.getEndDate())) {
            dto.setStatus("ENDED");
        } else if (!today.isAfter(event.getRegistrationDeadline()) && 
                   ChronoUnit.DAYS.between(today, event.getRegistrationDeadline()) <= 5) {
            dto.setStatus("DEADLINE_SOON");
        } else {
            dto.setStatus("UPCOMING");
        }

        long daysToDeadline = ChronoUnit.DAYS.between(today, event.getRegistrationDeadline());
        dto.setDaysToDeadline(daysToDeadline);

        if (user != null) {
            boolean isSaved = savedEventRepository.existsByUserAndEvent(user, event);
            dto.setSaved(isSaved);
        }

        return dto;
    }

    @Transactional
    public EventDto updateEvent(Long eventId, EventDto dto, MultipartFile posterFile) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("Event not found with ID: " + eventId));

        if (dto.getTitle() != null && !dto.getTitle().trim().isEmpty()) {
            event.setTitle(dto.getTitle().trim());
        }
        if (dto.getDescription() != null) {
            event.setDescription(dto.getDescription());
        }
        if (dto.getEventType() != null) {
            event.setEventType(dto.getEventType());
        }
        if (dto.getTeamSizeMin() != null) {
            event.setTeamSizeMin(dto.getTeamSizeMin());
        }
        if (dto.getTeamSizeMax() != null) {
            event.setTeamSizeMax(dto.getTeamSizeMax());
        }
        if (dto.getStartDate() != null) {
            event.setStartDate(dto.getStartDate());
        }
        if (dto.getEndDate() != null) {
            event.setEndDate(dto.getEndDate());
        }
        if (dto.getRegistrationDeadline() != null) {
            event.setRegistrationDeadline(dto.getRegistrationDeadline());
        }
        if (dto.getMode() != null) {
            event.setMode(dto.getMode());
        }
        if (dto.getVenue() != null) {
            event.setVenue(dto.getVenue());
        }
        if (dto.getRegistrationLink() != null) {
            event.setRegistrationLink(dto.getRegistrationLink());
        }
        if (dto.getSkills() != null) {
            event.setSkills(dto.getSkills());
        }

        if (posterFile != null && !posterFile.isEmpty()) {
            String posterUrl = fileStorageService.storeFile(posterFile);
            event.setPosterPath(posterUrl);
        } else if (dto.getPosterPath() != null && !dto.getPosterPath().trim().isEmpty()) {
            event.setPosterPath(dto.getPosterPath());
        }

        Event saved = eventRepository.save(event);
        return mapToDto(saved, null);
    }

    @Transactional
    public void deleteEvent(Long eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("Event not found with ID: " + eventId));

        savedEventRepository.deleteByEvent(event);
        reportRepository.deleteByEvent(event);
        teamRequestRepository.deleteByEvent(event);

        List<Team> teams = teamRepository.findByEventOrderByCreatedAtDesc(event);
        for (Team t : teams) {
            teamMemberRepository.deleteAll(teamMemberRepository.findByTeamAndStatus(t, "ACCEPTED"));
            teamRepository.delete(t);
        }

        eventRepository.delete(event);
    }
}
