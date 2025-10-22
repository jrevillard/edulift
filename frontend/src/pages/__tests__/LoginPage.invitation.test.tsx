import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../../test/test-utils";
import LoginPage from "../LoginPage";
import "@testing-library/jest-dom";

// Mock the useAuth hook
const mockLogin = vi.fn();
vi.mock("../../contexts/AuthContext", async () => {
  const actual = await vi.importActual("../../contexts/AuthContext");
  return {
    ...actual,
    useAuth: () => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      family: null,
      login: mockLogin,
      verifyMagicLink: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    }),
  };
});

// Mock useSearchParams to simulate URL parameters
const mockSearchParams = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams()],
    useNavigate: () => vi.fn(),
    useLocation: () => ({ state: null }),
  };
});

describe("LoginPage - Invitation Code Extraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue(undefined);
  });

  describe("Group Invitation URLs", () => {
    it("should extract inviteCode from group join URL in returnTo parameter", async () => {
      const inviteCode = "7A5D203";
      const returnToUrl = `/groups/join?code=${inviteCode}`;
      
      mockSearchParams.mockReturnValue({
        get: vi.fn((param) => {
          if (param === 'returnTo') return returnToUrl;
          return null;
        }),
      });

      const user = userEvent.setup();
      render(<LoginPage />);

      // Fill in email and submit
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, "test@example.com");
      
      const submitButton = screen.getByTestId("LoginPage-Button-sendMagicLink");
      await user.click(submitButton);

      // Verify that login was called with the correct inviteCode
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          "test@example.com",
          undefined,
          inviteCode
        );
      });
    });

    it("should extract inviteCode from encoded group join URL", async () => {
      const inviteCode = "GRP789XYZ";
      const returnToUrl = encodeURIComponent(`/groups/join?code=${inviteCode}`);
      
      mockSearchParams.mockReturnValue({
        get: vi.fn((param) => {
          if (param === 'returnTo') return returnToUrl;
          return null;
        }),
      });

      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, "test@example.com");
      
      const submitButton = screen.getByTestId("LoginPage-Button-sendMagicLink");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          "test@example.com",
          undefined,
          inviteCode
        );
      });
    });
  });

  describe("Family Invitation URLs", () => {
    it("should extract inviteCode from family join URL in returnTo parameter", async () => {
      const inviteCode = "FAM123ABC";
      const returnToUrl = `/families/join?code=${inviteCode}`;
      
      mockSearchParams.mockReturnValue({
        get: vi.fn((param) => {
          if (param === 'returnTo') return returnToUrl;
          return null;
        }),
      });

      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, "test@example.com");
      
      const submitButton = screen.getByTestId("LoginPage-Button-sendMagicLink");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          "test@example.com",
          undefined,
          inviteCode
        );
      });
    });
  });

  describe("Edge Cases", () => {
    it("should not extract inviteCode when returnTo is not an invitation URL", async () => {
      mockSearchParams.mockReturnValue({
        get: vi.fn((param) => {
          if (param === 'returnTo') return '/dashboard';
          return null;
        }),
      });

      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, "test@example.com");
      
      const submitButton = screen.getByTestId("LoginPage-Button-sendMagicLink");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          "test@example.com",
          undefined,
          undefined // No inviteCode should be passed
        );
      });
    });

    it("should not extract inviteCode when returnTo parameter is missing", async () => {
      mockSearchParams.mockReturnValue({
        get: vi.fn(() => null),
      });

      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, "test@example.com");
      
      const submitButton = screen.getByTestId("LoginPage-Button-sendMagicLink");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          "test@example.com",
          undefined,
          undefined
        );
      });
    });

    it("should extract inviteCode using regex fallback for malformed URLs", async () => {
      const inviteCode = "REGEX123";
      const malformedUrl = `groups/join?code=${inviteCode}&extra=param`;
      
      mockSearchParams.mockReturnValue({
        get: vi.fn((param) => {
          if (param === 'returnTo') return malformedUrl;
          return null;
        }),
      });

      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, "test@example.com");
      
      const submitButton = screen.getByTestId("LoginPage-Button-sendMagicLink");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          "test@example.com",
          undefined,
          inviteCode
        );
      });
    });
  });

  describe("New User Flow with Invitation", () => {
    it("should extract inviteCode for new user signup with group invitation", async () => {
      const inviteCode = "NEWUSER123";
      const returnToUrl = `/groups/join?code=${inviteCode}`;
      
      mockSearchParams.mockReturnValue({
        get: vi.fn((param) => {
          if (param === 'returnTo') return returnToUrl;
          return null;
        }),
      });

      // Mock that user needs to provide name (new user)
      mockLogin.mockRejectedValueOnce(
        new Error("Name is required for new users")
      );
      mockLogin.mockResolvedValueOnce(undefined);

      const user = userEvent.setup();
      render(<LoginPage />);

      // Submit with just email first (existing user tab is default)
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, "newuser@example.com");
      
      let submitButton = screen.getByTestId("LoginPage-Button-sendMagicLink");
      await user.click(submitButton);

      // Should show name field for new user (switches to new user tab automatically)
      await waitFor(() => {
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      });

      // Fill in name and submit again
      const nameInput = screen.getByLabelText(/full name/i);
      await user.type(nameInput, "New User");
      
      submitButton = screen.getByTestId("LoginPage-Button-createAccount");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenLastCalledWith(
          "newuser@example.com",
          "New User",
          inviteCode
        );
      });
    });
  });
});