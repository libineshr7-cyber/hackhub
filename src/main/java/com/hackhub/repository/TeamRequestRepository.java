package com.hackhub.repository;

import com.hackhub.entity.Event;
import com.hackhub.entity.Team;
import com.hackhub.entity.TeamRequest;
import com.hackhub.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeamRequestRepository extends JpaRepository<TeamRequest, Long> {
    List<TeamRequest> findByTeamOrderByCreatedAtDesc(Team team);
    List<TeamRequest> findByTeamInAndStatus(List<Team> teams, String status);
    List<TeamRequest> findByRequesterOrderByCreatedAtDesc(User requester);
    Optional<TeamRequest> findByTeamAndRequesterAndStatus(Team team, User requester, String status);
    boolean existsByTeamAndRequesterAndStatus(Team team, User requester, String status);
}
