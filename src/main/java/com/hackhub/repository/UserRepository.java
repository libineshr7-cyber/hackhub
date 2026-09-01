package com.hackhub.repository;

import com.hackhub.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByRegistrationNumber(String registrationNumber);
    Optional<User> findByEmail(String email);
    boolean existsByRegistrationNumber(String registrationNumber);
    List<User> findByRegistrationNumberContainingOrNameContaining(String regNo, String name);
    long countByRole(String role);
    List<User> findByRole(String role);
    List<User> findByDepartment(String department);
    List<User> findByRoleAndDepartment(String role, String department);
    List<User> findByRegistrationNumberStartingWith(String prefix);
}
