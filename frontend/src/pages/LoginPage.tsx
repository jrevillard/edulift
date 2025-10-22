import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  Mail,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Info,
  Shield,
  Zap,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);

  const { login, verifyMagicLink, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const handleMagicLinkVerification = useCallback(async (token: string) => {
    setIsLoading(true);
    setError("");

    try {
      await verifyMagicLink(token);
      // Will be redirected by useEffect above
    } catch (error) {
      console.error("Magic link verification failed:", error);
      setError(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setIsLoading(false);
    }
  }, [verifyMagicLink]);

  // Check for magic link token in URL
  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      handleMagicLinkVerification(token);
    }
  }, [searchParams, handleMagicLinkVerification]);

  // Check for success state from URL (e.g., after magic link was sent)
  useEffect(() => {
    const success = searchParams.get("success");
    const emailParam = searchParams.get("email");
    if (success === "true" && emailParam) {
      setIsSuccess(true);
      setEmail(emailParam);
    }
  }, [searchParams]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Check for returnTo query param first, then stored redirect path, then location state, then default
      const redirectTo = searchParams.get('returnTo');
      let redirectPath = null;
      
      try {
        redirectPath = localStorage.getItem('redirectAfterLogin');
      } catch (error) {
        console.error('Error accessing localStorage:', error);
      }
      
      const from = redirectTo || redirectPath || location.state?.from?.pathname || "/dashboard";
      
      // Clear the stored redirect path
      if (redirectPath) {
        try {
          localStorage.removeItem('redirectAfterLogin');
        } catch (error) {
          console.error('Error removing item from localStorage:', error);
        }
      }
      
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location, searchParams]);

  const handleSubmit = async () => {
    if (!email) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email");
      return;
    }

    setIsLoading(true);
    setError("");

    // Store redirectTo in localStorage so it persists after the magic link login
    const redirectTo = searchParams.get('returnTo');
    console.log('🔍 DEBUG: LoginPage - redirectTo from searchParams (using returnTo):', redirectTo);
    if (redirectTo) {
      localStorage.setItem('redirectAfterLogin', redirectTo);
    }

    // Extract invite code from redirectTo URL if it contains a family join page
    let inviteCode: string | undefined;
    if (redirectTo) {
      console.log('🔍 DEBUG: Processing redirectTo URL:', redirectTo);
      
      // First try to decode the URL in case it's encoded
      let decodedRedirectTo = redirectTo;
      try {
        decodedRedirectTo = decodeURIComponent(redirectTo);
        console.log('🔍 DEBUG: Decoded URL:', decodedRedirectTo);
      } catch (error) {
        console.log('🔍 DEBUG: URL decoding failed, using original');
      }
      
      try {
        const redirectUrl = new URL(decodedRedirectTo, window.location.origin);
        console.log('🔍 DEBUG: Parsed URL pathname:', redirectUrl.pathname);
        console.log('🔍 DEBUG: Parsed URL search params:', redirectUrl.search);
        if (redirectUrl.pathname === '/families/join') {
          inviteCode = redirectUrl.searchParams.get('code') || undefined;
          console.log('🔍 DEBUG: Extracted invite code from /families/join:', inviteCode);
        } else if (redirectUrl.pathname === '/groups/join') {
          inviteCode = redirectUrl.searchParams.get('code') || undefined;
          console.log('🔍 DEBUG: Extracted invite code from /groups/join:', inviteCode);
        }
      } catch (error) {
        console.log('🔍 DEBUG: URL parsing failed, trying regex patterns...');
        // If redirectTo is not a valid URL, it might be a relative path - try both original and decoded
        const urlToCheck = decodedRedirectTo || redirectTo;
        if (urlToCheck.includes('/families/join?code=') || urlToCheck.includes('/groups/join?code=')) {
          const codeMatch = urlToCheck.match(/code=([^&]+)/);
          if (codeMatch) {
            inviteCode = codeMatch[1];
            console.log('🔍 DEBUG: Extracted invite code via regex:', inviteCode);
          }
        }
      }
    }
    console.log('🔍 DEBUG: Final invite code to pass to login:', inviteCode);

    try {
      await login(email.trim(), isNewUser ? name.trim() : undefined, inviteCode);
      setIsSuccess(true);
    } catch (err) {
      console.error("Login error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send magic link";

      // If the error is about name being required for new users, automatically switch to new user mode
      if (errorMessage.includes("Name is required for new users")) {
        if (!isNewUser) {
          setIsNewUser(true);
          setError(
            "Welcome! This appears to be your first time using EduLift. Please provide your name to create your account."
          );
        } else {
          setError("Please provide your full name to create your account.");
        }
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && email) {
      handleSubmit();
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background/50 via-background to-muted/50 p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="pt-6">
            <div className="text-center space-y-4" data-testid="LoginPage-Container-magicLinkSent">
              <div className="mx-auto w-16 h-16 bg-success-100 rounded-full flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-8 h-8 text-success-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-foreground" data-testid="LoginPage-Heading-checkEmail">
                  Check your email!
                </h2>
                <p className="text-muted-foreground">
                  We've sent a login link to:
                </p>
                <p className="font-medium text-foreground bg-muted rounded-lg px-4 py-2 inline-block">
                  {email}
                </p>
              </div>
              <Alert className="bg-info-50 border-info-200">
                <Info className="h-4 w-4 text-info-600" />
                <AlertDescription className="text-info-800">
                  The link expires in 15 minutes. Check your spam folder if you
                  can't find it.
                </AlertDescription>
              </Alert>
              <div className="pt-4">
                <button
                  onClick={() => {
                    setIsSuccess(false);
                    setEmail("");
                    setName("");
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Use a different email address
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-secondary p-12 flex-col justify-between relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 -left-1/4 w-96 h-96 bg-background rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 -right-1/4 w-96 h-96 bg-background rounded-full blur-3xl"></div>
        </div>

        <div className="text-white relative z-10">
          <div className="flex items-center gap-2 mb-8">
            <div className="p-2 bg-background/20 rounded-xl">
              <Sparkles className="w-6 h-6" />
            </div>
            <h1 className="text-4xl font-bold">EduLift</h1>
          </div>
          <Badge
            variant="secondary"
            className="bg-background/20 text-background border-0"
          >
            Collaborative School Transportation
          </Badge>
        </div>

        <div className="space-y-8 relative z-10">
          <div className="text-white">
            <h2 className="text-3xl font-semibold mb-4">
              Simplify School Transportation
            </h2>
            <p className="text-lg text-primary-foreground/80 leading-relaxed">
              Join a community of parents helping each other with children's
              transportation. Economical, ecological, and friendly.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-background/10 backdrop-blur-sm rounded-lg p-4 hover:bg-background/20 transition-colors cursor-pointer">
              <div className="text-3xl font-bold text-white mb-1">2,500+</div>
              <div className="text-primary-foreground/70">Active Families</div>
            </div>
            <div className="bg-background/10 backdrop-blur-sm rounded-lg p-4 hover:bg-background/20 transition-colors cursor-pointer">
              <div className="text-3xl font-bold text-white mb-1">15,000+</div>
              <div className="text-primary-foreground/70">Monthly Trips</div>
            </div>
            <div className="bg-background/10 backdrop-blur-sm rounded-lg p-4 hover:bg-background/20 transition-colors cursor-pointer">
              <div className="text-3xl font-bold text-white mb-1">98%</div>
              <div className="text-primary-foreground/70">Satisfaction</div>
            </div>
            <div className="bg-background/10 backdrop-blur-sm rounded-lg p-4 hover:bg-background/20 transition-colors cursor-pointer">
              <div className="text-3xl font-bold text-white mb-1">-40%</div>
              <div className="text-primary-foreground/70">CO2 Saved</div>
            </div>
          </div>
        </div>

        <div className="text-primary-foreground/70 text-sm relative z-10">
          © 2025 EduLift. All rights reserved.
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-2xl animate-pulse">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-foreground" data-testid="LoginPage-Heading-welcome">
              Welcome to EduLift
            </h2>
            <p className="mt-2 text-muted-foreground" data-testid="LoginPage-Text-subtitle">
              Passwordless login, secure and simple
            </p>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl">Magic Link Login</CardTitle>
              <CardDescription>
                Receive a secure login link directly in your inbox
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                value={isNewUser ? "new" : "existing"}
                onValueChange={(value) => setIsNewUser(value === "new")}
                className="w-full"
                data-testid="LoginPage-Form-loginForm"
              >
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="existing" data-testid="LoginPage-Tab-existingUser">
                    Existing user
                  </TabsTrigger>
                  <TabsTrigger value="new" data-testid="LoginPage-Tab-newUser">
                    New user
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="existing" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-existing">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email-existing"
                        type="email"
                        placeholder="parent@exemple.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="pl-10"
                        required
                        disabled={isLoading}
                        data-testid="LoginPage-Input-email"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="new" className="space-y-4">
                  <Alert className="bg-success-50 border-success-200">
                    <Sparkles className="h-4 w-4 text-success-600" />
                    <AlertDescription className="text-success-800">
                      <strong>First time here?</strong> Create your account in
                      30 seconds!
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Jean Dupont"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyPress={handleKeyPress}
                      required={isNewUser}
                      disabled={isLoading}
                      data-testid="LoginPage-Input-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-new">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email-new"
                        type="email"
                        placeholder="parent@exemple.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="pl-10"
                        required
                        disabled={isLoading}
                        data-testid="LoginPage-Input-email"
                      />
                    </div>
                  </div>
                </TabsContent>

                {error && (
                  <Alert variant="destructive" data-testid="LoginPage-Alert-emailError">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleSubmit}
                  className="w-full"
                  size="lg"
                  disabled={isLoading || !email || (isNewUser && !name)}
                  data-testid={isNewUser ? "LoginPage-Button-createAccount" : "LoginPage-Button-sendMagicLink"}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      {isNewUser ? "Create Account" : "Send Magic Link"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </Tabs>

              <div className="mt-6 space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Why choose EduLift
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center space-y-2 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="mx-auto w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground">100% Secure</p>
                  </div>
                  <div className="text-center space-y-2 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="mx-auto w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center">
                      <Zap className="h-5 w-5 text-success-600" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Lightning fast
                    </p>
                  </div>
                  <div className="text-center space-y-2 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="mx-auto w-10 h-10 bg-secondary-100 rounded-lg flex items-center justify-center">
                      <Target className="h-5 w-5 text-secondary-600" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Passwordless
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            By continuing, you agree to our{" "}
            <a
              href="#"
              className="font-medium text-primary hover:text-primary/80 hover:underline"
            >
              terms of service
            </a>{" "}
            and{" "}
            <a
              href="#"
              className="font-medium text-primary hover:text-primary/80 hover:underline"
            >
              privacy policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
