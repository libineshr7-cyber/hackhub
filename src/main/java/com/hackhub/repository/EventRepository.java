package com.hackhub.repository;

import com.hackhub.entity.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {

    List<Event> findByEndDateGreaterThanEqualOrderByStartDateAsc(LocalDate date);

    List<Event> findByEndDateLessThanOrderByEndDateDesc(LocalDate date);

    List<Event> findByRegistrationDeadlineBetweenOrderByRegistrationDeadlineAsc(LocalDate start, LocalDate end);

    @Query("SELECT e FROM Event e WHERE " +
           "(:query IS NULL OR LOWER(e.title) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(e.description) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(e.skills) LIKE LOWER(CONCAT('%', :query, '%'))) AND " +
           "(:eventType IS NULL OR e.eventType = :eventType) AND " +
           "(:mode IS NULL OR e.mode = :mode)")
    List<Event> searchEvents(@Param("query") String query,
                             @Param("eventType") String eventType,
                             @Param("mode") String mode);

    long countByEndDateGreaterThanEqual(LocalDate date);
    long countByEndDateLessThan(LocalDate date);
    long countByCreatedBy(com.hackhub.entity.User user);
}
