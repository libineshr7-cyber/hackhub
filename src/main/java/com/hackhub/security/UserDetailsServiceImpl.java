package com.hackhub.security;

import com.hackhub.entity.User;
import com.hackhub.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

import java.util.Collections;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String registrationNumber) throws UsernameNotFoundException {
        User user = userRepository.findByRegistrationNumber(registrationNumber)
                .orElseThrow(() -> new UsernameNotFoundException("Student not found with reg number: " + registrationNumber));

        if ("DISABLED".equalsIgnoreCase(user.getStatus())) {
            throw new DisabledException("Account is disabled. Contact department admin.");
        }

        return new org.springframework.security.core.userdetails.User(
                user.getRegistrationNumber(),
                user.getPasswordHash(),
                Collections.singletonList(new SimpleGrantedAuthority(user.getRole()))
        );
    }
}
