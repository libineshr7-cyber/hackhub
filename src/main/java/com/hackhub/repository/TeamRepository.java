package com.hackhub.repository;

import com.hackhub.entity.Event;
import com.hackhub.entity.Team;
import com.hackhub.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TeamRepository extends JpaRepository<Team, Long> {
    List<Team> findByEventOrderByCreatedAtDesc(Event event);
    List<Team> findByCreatedBy(User user);
    List<Team> findAllByOrderByCreatedAtDesc();
}
