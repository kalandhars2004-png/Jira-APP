package com.jira.controller;

import com.jira.dto.ApiResponse;
import com.jira.dto.AuthDtos.*;
import com.jira.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest req) {
        AuthResponse res = userService.register(req);
        return ResponseEntity.ok(ApiResponse.success("User registered successfully", res));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest req) {
        AuthResponse res = userService.login(req);
        return ResponseEntity.ok(ApiResponse.success("Login successful", res));
    }

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<?>> getAllUsers() {
        return ResponseEntity.ok(ApiResponse.success(userService.getAll()));
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<ApiResponse<UserResponse>> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(userService.getUserResponse(id)));
    }
}
