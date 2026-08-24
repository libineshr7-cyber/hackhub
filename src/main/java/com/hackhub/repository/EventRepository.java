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

    java.util.Optional<Event> findByRegistrationLink(String registrationLink);

    List<Event> findByRegistrationLinkContaining(String keyword);



    List<Event> findByCreatedAtAfterOrderByCreatedAtDesc(java.time.LocalDateTime cutoff);

    long countByEndDateGreaterThanEqual(LocalDate date);
    long countByEndDateLessThan(LocalDate date);
    long countByCreatedBy(com.hackhub.entity.User user);
}
