package com.hackhub.repository;

import com.hackhub.entity.OtpRequest;
import com.hackhub.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.List;

@Repository
public interface OtpRequestRepository extends JpaRepository<OtpRequest, Long> {
    Optional<OtpRequest> findTopByUserAndUsedFalseAndExpiresAtGreaterThanOrderByCreatedAtDesc(User user, LocalDateTime now);
    List<OtpRequest> findByUserAndCreatedAtGreaterThan(User user, LocalDateTime since);
}
