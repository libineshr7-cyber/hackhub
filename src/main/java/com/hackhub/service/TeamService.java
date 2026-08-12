package com.hackhub.service;

import com.hackhub.dto.AuthDtos.ApiResponse;
import com.hackhub.dto.TeamDtos.*;
import com.hackhub.entity.*;
import com.hackhub.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class TeamService {

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private TeamMemberRepository teamMemberRepository;

    @Autowired
    private TeamRequestRepository teamRequestRepository;

    @Autowired
    private EventRepository eventRepository;

    @Transactional
    public TeamResponse createTeam(CreateTeamRequest request, User creator) {
        Event event = eventRepository.findById(request.getEventId())
                .orElseThrow(() -> new IllegalArgumentException("Event not found with ID: " + request.getEventId()));

        if (request.getTeamName() == null || request.getTeamName().trim().isEmpty()) {
            throw new IllegalArgumentException("Team name is required.");
        }

        int maxMembers = request.getMaxMembers() != null ? request.getMaxMembers() : event.getTeamSizeMax();
        if (maxMembers < 1 || maxMembers > event.getTeamSizeMax()) {
            maxMembers = event.getTeamSizeMax();
        }

        Team team = new Team();
        team.setEvent(event);
        team.setCreatedBy(creator);
        team.setTeamName(request.getTeamName().trim());
        team.setMaxMembers(maxMembers);
        Team savedTeam = teamRepository.save(team);

        // Creator automatically joins as active member
        TeamMember creatorMember = new TeamMember(savedTeam, creator, "ACTIVE");
        teamMemberRepository.save(creatorMember);

        return mapToTeamResponse(savedTeam, creator);
    }

    public List<TeamResponse> getTeamsByEvent(Long eventId, User currentUser) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("Event not found with ID: " + eventId));

        List<Team> teams = teamRepository.findByEventOrderByCreatedAtDesc(event);
        return teams.stream().map(t -> mapToTeamResponse(t, currentUser)).collect(Collectors.toList());
    }

    @Transactional
    public ApiResponse requestToJoinTeam(Long teamId, User requester) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("Team not found with ID: " + teamId));

        if (team.getCreatedBy().getId().equals(requester.getId())) {
            throw new IllegalArgumentException("You are the creator of this team.");
        }

        boolean isMember = teamMemberRepository.existsByTeamAndUserAndStatus(team, requester, "ACTIVE");
        if (isMember) {
            throw new IllegalArgumentException("You are already a member of this team.");
        }

        long currentCount = teamMemberRepository.countByTeamAndStatus(team, "ACTIVE");
        if (currentCount >= team.getMaxMembers()) {
            throw new IllegalStateException("Team is already full.");
        }

        boolean hasPending = teamRequestRepository.existsByTeamAndRequesterAndStatus(team, requester, "PENDING");
        if (hasPending) {
            throw new IllegalStateException("You already have a pending join request for this team.");
        }

        TeamRequest request = new TeamRequest(team, team.getEvent(), requester, "PENDING");
        teamRequestRepository.save(request);

        return new ApiResponse(true, "Request to join team '" + team.getTeamName() + "' submitted successfully!");
    }

    @Transactional
    public ApiResponse respondToTeamRequest(Long requestId, String status, User user) {
        TeamRequest request = teamRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Join request not found."));

        Team team = request.getTeam();
        if (!team.getCreatedBy().getId().equals(user.getId())) {
            throw new IllegalStateException("Only the team leader can accept or reject join requests.");
        }

        if (!"PENDING".equals(request.getStatus())) {
            throw new IllegalStateException("Request has already been processed.");
        }

        if ("ACCEPTED".equalsIgnoreCase(status)) {
            long currentCount = teamMemberRepository.countByTeamAndStatus(team, "ACTIVE");
            if (currentCount >= team.getMaxMembers()) {
                throw new IllegalStateException("Cannot accept request. Team is already full.");
            }

            request.setStatus("ACCEPTED");
            teamRequestRepository.save(request);

            // Add as active team member if not already
            if (!teamMemberRepository.existsByTeamAndUserAndStatus(team, request.getRequester(), "ACTIVE")) {
                TeamMember newMember = new TeamMember(team, request.getRequester(), "ACTIVE");
                teamMemberRepository.save(newMember);
            }

            return new ApiResponse(true, "Student " + request.getRequester().getName() + " accepted into the team!");

        } else if ("REJECTED".equalsIgnoreCase(status)) {
            request.setStatus("REJECTED");
            teamRequestRepository.save(request);
            return new ApiResponse(true, "Join request rejected.");
        } else {
            throw new IllegalArgumentException("Invalid status choice. Use ACCEPTED or REJECTED.");
        }
    }

    @Transactional
    public ApiResponse leaveTeam(Long teamId, User user) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("Team not found."));

        Optional<TeamMember> memberOpt = teamMemberRepository.findByTeamAndUserAndStatus(team, user, "ACTIVE");
        if (memberOpt.isEmpty()) {
            throw new IllegalArgumentException("You are not an active member of this team.");
        }

        TeamMember member = memberOpt.get();
        member.setStatus("LEFT");
        teamMemberRepository.save(member);

        return new ApiResponse(true, "You have left the team '" + team.getTeamName() + "'.");
    }

    public List<TeamRequestDto> getIncomingRequestsForUser(User user) {
        List<Team> createdTeams = teamRepository.findByCreatedBy(user);
        if (createdTeams.isEmpty()) {
            return Collections.emptyList();
        }

        List<TeamRequest> requests = teamRequestRepository.findByTeamInAndStatus(createdTeams, "PENDING");
        return requests.stream().map(this::mapToTeamRequestDto).collect(Collectors.toList());
    }

    public List<TeamRequestDto> getSentRequestsForUser(User user) {
        List<TeamRequest> requests = teamRequestRepository.findByRequesterOrderByCreatedAtDesc(user);
        return requests.stream().map(this::mapToTeamRequestDto).collect(Collectors.toList());
    }

    private TeamResponse mapToTeamResponse(Team team, User currentUser) {
        TeamResponse response = new TeamResponse();
        response.setId(team.getId());
        response.setEventId(team.getEvent().getId());
        response.setEventTitle(team.getEvent().getTitle());
        response.setTeamName(team.getTeamName());
        response.setMaxMembers(team.getMaxMembers());
        response.setCreatorRegistrationNumber(team.getCreatedBy().getRegistrationNumber());
        response.setCreatorName(team.getCreatedBy().getName());

        List<TeamMember> activeMembers = teamMemberRepository.findByTeamAndStatus(team, "ACTIVE");
        response.setCurrentMemberCount(activeMembers.size());

        List<TeamMemberDto> memberDtos = activeMembers.stream().map(m -> {
            TeamMemberDto memberDto = new TeamMemberDto();
            memberDto.setId(m.getId());
            memberDto.setRegistrationNumber(m.getUser().getRegistrationNumber());
            memberDto.setName(m.getUser().getName());
            memberDto.setEmail(m.getUser().getEmail());
            memberDto.setSkills(m.getUser().getSkills());
            memberDto.setStatus(m.getStatus());
            return memberDto;
        }).collect(Collectors.toList());
        response.setMembers(memberDtos);

        if (currentUser != null) {
            boolean isMember = activeMembers.stream().anyMatch(m -> m.getUser().getId().equals(currentUser.getId()));
            response.setUserMember(isMember);

            boolean hasRequested = teamRequestRepository.existsByTeamAndRequesterAndStatus(team, currentUser, "PENDING");
            response.setHasUserRequested(hasRequested);

            int matchScore = calculateSkillMatchScore(currentUser, team);
            response.setSkillMatchScore(matchScore);
        }

        return response;
    }

    private TeamRequestDto mapToTeamRequestDto(TeamRequest request) {
        TeamRequestDto dto = new TeamRequestDto();
        dto.setId(request.getId());
        dto.setTeamId(request.getTeam().getId());
        dto.setTeamName(request.getTeam().getTeamName());
        dto.setEventId(request.getEvent().getId());
        dto.setEventTitle(request.getEvent().getTitle());
        dto.setRequesterRegistrationNumber(request.getRequester().getRegistrationNumber());
        dto.setRequesterName(request.getRequester().getName());
        dto.setRequesterSkills(request.getRequester().getSkills());
        dto.setStatus(request.getStatus());
        dto.setCreatedAt(request.getCreatedAt());
        return dto;
    }

    /**
     * Skill matching logic comparing student's skills with Event skills & Team member skills
     */
    private int calculateSkillMatchScore(User user, Team team) {
        if (user.getSkills() == null || user.getSkills().trim().isEmpty()) {
            return 50; // Default match if student hasn't listed skills
        }

        Set<String> userSkills = parseSkills(user.getSkills());
        if (userSkills.isEmpty()) return 50;

        Set<String> targetSkills = new HashSet<>();
        if (team.getEvent().getSkills() != null) {
            targetSkills.addAll(parseSkills(team.getEvent().getSkills()));
        }

        if (targetSkills.isEmpty()) {
            return 75; // Moderate match for open event
        }

        long matchCount = userSkills.stream().filter(targetSkills::contains).count();
        if (matchCount == 0) return 30;

        int score = (int) Math.min(100, Math.round(((double) matchCount / targetSkills.size()) * 100));
        return Math.max(40, score);
    }

    private Set<String> parseSkills(String skillString) {
        if (skillString == null || skillString.trim().isEmpty()) return Collections.emptySet();
        return Arrays.stream(skillString.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }
}
