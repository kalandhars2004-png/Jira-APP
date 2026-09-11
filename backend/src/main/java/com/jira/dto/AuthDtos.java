package com.jira.dto;

import com.jira.enums.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

public class AuthDtos {

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class RegisterRequest {
        @NotBlank @Size(min=2, max=50)
        private String name;
        @NotBlank @Email
        private String email;
        @NotBlank @Size(min=4, max=100)
        private String password;
        private UserRole role;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class LoginRequest {
        @NotBlank @Email
        private String email;
        @NotBlank
        private String password;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class UserResponse {
        private Long id;
        private String name;
        private String email;
        private UserRole role;
        private String createdAt;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AuthResponse {
        private Long id;
        private String name;
        private String email;
        private UserRole role;
        private String token; // simple token = userId for this challenge
        private String message;
    }
}
