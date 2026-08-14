package com.hackhub.repository;

import com.hackhub.entity.Event;
import com.hackhub.entity.SavedEvent;
import com.hackhub.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SavedEventRepository extends JpaRepository<SavedEvent, Long> {
    List<SavedEvent> findByUserOrderByCreatedAtDesc(User user);
    Optional<SavedEvent> findByUserAndEvent(User user, Event event);
    boolean existsByUserAndEvent(User user, Event event);
    
    @org.springframework.data.jpa.repository.Query("SELECT s.event.id FROM SavedEvent s WHERE s.user = :user")
    java.util.Set<Long> findSavedEventIdsByUser(@org.springframework.data.repository.query.Param("user") User user);

    void deleteByUserAndEvent(User user, Event event);
    void deleteByEvent(Event event);
    long countByUser(User user);
}
