import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../../test/test-utils";
import LoginPage from "../LoginPage";
import * as authService from "../../services/authService";
import "@testing-library/jest-dom";

// Mock the auth service
vi.mock("../../services/authService", () => ({
  authService: {
    isAuthenticated: vi.fn(() => false),
    isTokenExpired: vi.fn(() => false),
    getUser: vi.fn(() => null),
    getToken: vi.fn(() => null),
    requestMagicLink: vi.fn(),
    verifyMagicLink: vi.fn(),
    refreshToken: vi.fn(),
    logout: vi.fn(),
    setAuthChangeCallback: vi.fn(),
  },
}));

const mockAuthService = vi.mocked(authService.authService);

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login form correctly", () => {
    render(<LoginPage />);

    expect(
      screen.getByTestId("LoginPage-Heading-welcome")
    ).toHaveTextContent(/welcome to edulift/i);
    expect(
      screen.getByTestId("LoginPage-Text-subtitle")
    ).toHaveTextContent(/passwordless login, secure and simple/i);
    expect(
      screen.getByTestId("LoginPage-Tab-existingUser")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("LoginPage-Tab-newUser")
    ).toBeInTheDocument();
  });

  it("shows name field when new user is selected", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    // Initially, name field should not be visible
    expect(screen.queryByTestId("LoginPage-Input-name")).not.toBeInTheDocument();

    // Click "New to EduLift?" to show name field
    const newUserTab = screen.getByTestId("LoginPage-Tab-newUser");
    await user.click(newUserTab);

    // Now name field should be visible
    expect(screen.getByTestId("LoginPage-Input-name")).toBeInTheDocument();
    expect(
      screen.getByTestId("LoginPage-Tab-existingUser")
    ).toBeInTheDocument();
  });

  it("requires name field for new users", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    // Click "New to EduLift?" to show name field
    const newUserTab = screen.getByTestId("LoginPage-Tab-newUser");
    await user.click(newUserTab);

    const nameInput = screen.getByTestId("LoginPage-Input-name");

    // Name field should be required for new users
    expect(nameInput).toBeRequired();
  });

  it("submits form with valid data for new user", async () => {
    const user = userEvent.setup();
    mockAuthService.requestMagicLink.mockResolvedValueOnce(undefined);

    render(<LoginPage />);

    // Switch to new user mode
    const newUserTab = screen.getByTestId("LoginPage-Tab-newUser");
    await user.click(newUserTab);

    const emailInput = screen.getByTestId("LoginPage-Input-email");
    const nameInput = screen.getByTestId("LoginPage-Input-name");
    const submitButton = screen.getByTestId("LoginPage-Button-createAccount");

    await user.type(emailInput, "test@example.com");
    await user.type(nameInput, "Test User");
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith(
        "test@example.com",
        { name: "Test User" }
      );
    });
  });

  it("shows success message after successful submission", async () => {
    const user = userEvent.setup();
    mockAuthService.requestMagicLink.mockResolvedValueOnce(undefined);

    render(<LoginPage />);

    const emailInput = screen.getByTestId("LoginPage-Input-email");
    const submitButton = screen.getByTestId("LoginPage-Button-sendMagicLink");

    await user.type(emailInput, "test@example.com");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByTestId("LoginPage-Heading-checkEmail")).toHaveTextContent(/check your email!/i);
    });
  });

  it("automatically switches to new user tab when name is required", async () => {
    const user = userEvent.setup();
    mockAuthService.requestMagicLink.mockRejectedValueOnce(
      new Error("Name is required for new users")
    );

    render(<LoginPage />);

    // Start in existing user tab
    expect(screen.queryByTestId("LoginPage-Input-name")).not.toBeInTheDocument();

    // Enter email and submit
    const emailInput = screen.getByTestId("LoginPage-Input-email");
    const submitButton = screen.getByTestId("LoginPage-Button-sendMagicLink");

    await user.type(emailInput, "newuser@example.com");
    await user.click(submitButton);

    // Wait for error handling
    await waitFor(() => {
      // Verify tab switched to new user
      expect(screen.getByTestId("LoginPage-Input-name")).toBeInTheDocument();
      
      // Verify error message
      expect(
        screen.getByTestId("LoginPage-Alert-emailError")
      ).toHaveTextContent(
        /Welcome! This appears to be your first time using EduLift. Please provide your name to create your account./i
      );
    });
  });
});
