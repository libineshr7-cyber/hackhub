package com.hackhub.dto;

import java.time.LocalDate;

public class EventDto {

    private Long id;
    private String title;
    private String description;
    private String eventType;
    private Integer teamSizeMin;
    private Integer teamSizeMax;
    private LocalDate startDate;
    private LocalDate endDate;
    private LocalDate registrationDeadline;
    private String posterPath;
    private String registrationLink;
    private String mode;
    private String venue;
    private String skills;
    private String createdByRegNo;
    private String createdByName;
    private String status; // UPCOMING, ENDED, DEADLINE_SOON
    private boolean saved;
    private long daysToDeadline;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public Integer getTeamSizeMin() { return teamSizeMin; }
    public void setTeamSizeMin(Integer teamSizeMin) { this.teamSizeMin = teamSizeMin; }

    public Integer getTeamSizeMax() { return teamSizeMax; }
    public void setTeamSizeMax(Integer teamSizeMax) { this.teamSizeMax = teamSizeMax; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public LocalDate getRegistrationDeadline() { return registrationDeadline; }
    public void setRegistrationDeadline(LocalDate registrationDeadline) { this.registrationDeadline = registrationDeadline; }

    public String getPosterPath() { return posterPath; }
    public void setPosterPath(String posterPath) { this.posterPath = posterPath; }

    public String getRegistrationLink() { return registrationLink; }
    public void setRegistrationLink(String registrationLink) { this.registrationLink = registrationLink; }

    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }

    public String getVenue() { return venue; }
    public void setVenue(String venue) { this.venue = venue; }

    public String getSkills() { return skills; }
    public void setSkills(String skills) { this.skills = skills; }

    public String getCreatedByRegNo() { return createdByRegNo; }
    public void setCreatedByRegNo(String createdByRegNo) { this.createdByRegNo = createdByRegNo; }

    public String getCreatedByName() { return createdByName; }
    public void setCreatedByName(String createdByName) { this.createdByName = createdByName; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public boolean isSaved() { return saved; }
    public void setSaved(boolean saved) { this.saved = saved; }

    public long getDaysToDeadline() { return daysToDeadline; }
    public void setDaysToDeadline(long daysToDeadline) { this.daysToDeadline = daysToDeadline; }
}
