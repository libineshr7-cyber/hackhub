package com.hackhub.repository;

import com.hackhub.entity.Team;
import com.hackhub.entity.TeamMember;
import com.hackhub.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {
    List<TeamMember> findByTeamAndStatus(Team team, String status);
    List<TeamMember> findByUserAndStatus(User user, String status);
    Optional<TeamMember> findByTeamAndUserAndStatus(Team team, User user, String status);
    long countByTeamAndStatus(Team team, String status);
    boolean existsByTeamAndUserAndStatus(Team team, User user, String status);
}
