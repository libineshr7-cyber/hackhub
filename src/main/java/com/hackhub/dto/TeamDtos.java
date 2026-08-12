package com.hackhub.dto;

import java.time.LocalDateTime;
import java.util.List;

public class TeamDtos {

    public static class CreateTeamRequest {
        private Long eventId;
        private String teamName;
        private Integer maxMembers;

        public Long getEventId() { return eventId; }
        public void setEventId(Long eventId) { this.eventId = eventId; }
        public String getTeamName() { return teamName; }
        public void setTeamName(String teamName) { this.teamName = teamName; }
        public Integer getMaxMembers() { return maxMembers; }
        public void setMaxMembers(Integer maxMembers) { this.maxMembers = maxMembers; }
    }

    public static class TeamMemberDto {
        private Long id;
        private String registrationNumber;
        private String name;
        private String email;
        private String skills;
        private String status;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getRegistrationNumber() { return registrationNumber; }
        public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getSkills() { return skills; }
        public void setSkills(String skills) { this.skills = skills; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }

    public static class TeamResponse {
        private Long id;
        private Long eventId;
        private String eventTitle;
        private String teamName;
        private Integer maxMembers;
        private Integer currentMemberCount;
        private String creatorRegistrationNumber;
        private String creatorName;
        private List<TeamMemberDto> members;
        private int skillMatchScore; // Percentage match for current user
        private boolean isUserMember;
        private boolean hasUserRequested;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public Long getEventId() { return eventId; }
        public void setEventId(Long eventId) { this.eventId = eventId; }
        public String getEventTitle() { return eventTitle; }
        public void setEventTitle(String eventTitle) { this.eventTitle = eventTitle; }
        public String getTeamName() { return teamName; }
        public void setTeamName(String teamName) { this.teamName = teamName; }
        public Integer getMaxMembers() { return maxMembers; }
        public void setMaxMembers(Integer maxMembers) { this.maxMembers = maxMembers; }
        public Integer getCurrentMemberCount() { return currentMemberCount; }
        public void setCurrentMemberCount(Integer currentMemberCount) { this.currentMemberCount = currentMemberCount; }
        public String getCreatorRegistrationNumber() { return creatorRegistrationNumber; }
        public void setCreatorRegistrationNumber(String creatorRegistrationNumber) { this.creatorRegistrationNumber = creatorRegistrationNumber; }
        public String getCreatorName() { return creatorName; }
        public void setCreatorName(String creatorName) { this.creatorName = creatorName; }
        public List<TeamMemberDto> getMembers() { return members; }
        public void setMembers(List<TeamMemberDto> members) { this.members = members; }
        public int getSkillMatchScore() { return skillMatchScore; }
        public void setSkillMatchScore(int skillMatchScore) { this.skillMatchScore = skillMatchScore; }
        public boolean isUserMember() { return isUserMember; }
        public void setUserMember(boolean userMember) { isUserMember = userMember; }
        public boolean isHasUserRequested() { return hasUserRequested; }
        public void setHasUserRequested(boolean hasUserRequested) { this.hasUserRequested = hasUserRequested; }
    }

    public static class JoinTeamRequest {
        private Long teamId;

        public Long getTeamId() { return teamId; }
        public void setTeamId(Long teamId) { this.teamId = teamId; }
    }

    public static class TeamRequestDto {
        private Long id;
        private Long teamId;
        private String teamName;
        private Long eventId;
        private String eventTitle;
        private String requesterRegistrationNumber;
        private String requesterName;
        private String requesterSkills;
        private String status;
        private LocalDateTime createdAt;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public Long getTeamId() { return teamId; }
        public void setTeamId(Long teamId) { this.teamId = teamId; }
        public String getTeamName() { return teamName; }
        public void setTeamName(String teamName) { this.teamName = teamName; }
        public Long getEventId() { return eventId; }
        public void setEventId(Long eventId) { this.eventId = eventId; }
        public String getEventTitle() { return eventTitle; }
        public void setEventTitle(String eventTitle) { this.eventTitle = eventTitle; }
        public String getRequesterRegistrationNumber() { return requesterRegistrationNumber; }
        public void setRequesterRegistrationNumber(String requesterRegistrationNumber) { this.requesterRegistrationNumber = requesterRegistrationNumber; }
        public String getRequesterName() { return requesterName; }
        public void setRequesterName(String requesterName) { this.requesterName = requesterName; }
        public String getRequesterSkills() { return requesterSkills; }
        public void setRequesterSkills(String requesterSkills) { this.requesterSkills = requesterSkills; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public LocalDateTime getCreatedAt() { return createdAt; }
        public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    }
    public static class InviteTeammateRequest {
        private Long teamId;
        private String regNoOrName;

        public Long getTeamId() { return teamId; }
        public void setTeamId(Long teamId) { this.teamId = teamId; }
        public String getRegNoOrName() { return regNoOrName; }
        public void setRegNoOrName(String regNoOrName) { this.regNoOrName = regNoOrName; }
    }
}
