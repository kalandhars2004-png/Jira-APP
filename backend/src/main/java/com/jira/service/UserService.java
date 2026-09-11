package com.jira.service;

import com.jira.dto.AuthDtos.*;
import com.jira.entity.User;
import com.jira.enums.UserRole;
import com.jira.exception.ResourceNotFoundException;
import com.jira.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepo;

    public AuthResponse register(RegisterRequest req) {
        if (userRepo.existsByEmail(req.getEmail())) {
            throw new IllegalArgumentException("Email already registered");
        }
        User user = User.builder()
                .name(req.getName())
                .email(req.getEmail())
                .password(req.getPassword()) // plain for challenge - not hashing to keep simple
                .role(req.getRole() != null ? req.getRole() : UserRole.MEMBER)
                .build();
        user = userRepo.save(user);
        return toAuthResponse(user);
    }

    public AuthResponse login(LoginRequest req) {
        User user = userRepo.findByEmail(req.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("Invalid email or password"));
        if (!user.getPassword().equals(req.getPassword())) {
            throw new IllegalArgumentException("Invalid email or password");
        }
        return toAuthResponse(user);
    }

    public List<UserResponse> getAll() {
        return userRepo.findAll().stream().map(this::toUserResponse).collect(Collectors.toList());
    }

    public User getById(Long id) {
        return userRepo.findById(id).orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    public UserResponse getUserResponse(Long id) {
        return toUserResponse(getById(id));
    }

    private AuthResponse toAuthResponse(User u) {
        return AuthResponse.builder()
                .id(u.getId())
                .name(u.getName())
                .email(u.getEmail())
                .role(u.getRole())
                .token(String.valueOf(u.getId())) // simple token
                .message("Success")
                .build();
    }

    private UserResponse toUserResponse(User u) {
        return UserResponse.builder()
                .id(u.getId())
                .name(u.getName())
                .email(u.getEmail())
                .role(u.getRole())
                .createdAt(u.getCreatedAt() != null ? u.getCreatedAt().toString() : null)
                .build();
    }
}
