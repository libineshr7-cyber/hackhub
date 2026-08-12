package com.hackhub.controller;

import com.hackhub.dto.AuthDtos.ApiResponse;
import com.hackhub.dto.TeamDtos.*;
import com.hackhub.entity.User;
import com.hackhub.repository.UserRepository;
import com.hackhub.service.TeamService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/teams")
public class TeamController {

    @Autowired
    private TeamService teamService;

    @Autowired
    private UserRepository userRepository;

    private User getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("Authentication required.");
        }
        return userRepository.findByRegistrationNumber(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + authentication.getName()));
    }

    @PostMapping
    public ResponseEntity<?> createTeam(@RequestBody CreateTeamRequest request, Authentication authentication) {
        try {
            User currentUser = getCurrentUser(authentication);
            TeamResponse response = teamService.createTeam(request, currentUser);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @GetMapping("/event/{eventId}")
    public ResponseEntity<?> getTeamsByEvent(@PathVariable("eventId") Long eventId, Authentication authentication) {
        try {
            User currentUser = getCurrentUser(authentication);
            List<TeamResponse> teams = teamService.getTeamsByEvent(eventId, currentUser);
            return ResponseEntity.ok(teams);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @PostMapping("/request")
    public ResponseEntity<?> requestToJoinTeam(@RequestBody JoinTeamRequest request, Authentication authentication) {
        try {
            User currentUser = getCurrentUser(authentication);
            ApiResponse response = teamService.requestToJoinTeam(request.getTeamId(), currentUser);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @PostMapping("/invite")
    public ResponseEntity<?> inviteTeammate(@RequestBody InviteTeammateRequest request, Authentication authentication) {
        try {
            User currentUser = getCurrentUser(authentication);
            ApiResponse response = teamService.inviteTeammateByNameOrRegNo(request.getTeamId(), request.getRegNoOrName(), currentUser);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @GetMapping("/search-students")
    public ResponseEntity<?> searchStudents(@RequestParam("query") String query) {
        try {
            List<Map<String, String>> students = teamService.searchStudents(query);
            return ResponseEntity.ok(students);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @PostMapping("/request/{id}/respond")
    public ResponseEntity<?> respondToRequest(@PathVariable("id") Long requestId, @RequestBody Map<String, String> body, Authentication authentication) {
        try {
            User currentUser = getCurrentUser(authentication);
            String status = body.get("status");
            ApiResponse response = teamService.respondToTeamRequest(requestId, status, currentUser);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @PostMapping("/leave/{teamId}")
    public ResponseEntity<?> leaveTeam(@PathVariable("teamId") Long teamId, Authentication authentication) {
        try {
            User currentUser = getCurrentUser(authentication);
            ApiResponse response = teamService.leaveTeam(teamId, currentUser);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @GetMapping("/requests/incoming")
    public ResponseEntity<?> getIncomingRequests(Authentication authentication) {
        try {
            User currentUser = getCurrentUser(authentication);
            List<TeamRequestDto> requests = teamService.getIncomingRequestsForUser(currentUser);
            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @GetMapping("/requests/sent")
    public ResponseEntity<?> getSentRequests(Authentication authentication) {
        try {
            User currentUser = getCurrentUser(authentication);
            List<TeamRequestDto> requests = teamService.getSentRequestsForUser(currentUser);
            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        }
    }
}
