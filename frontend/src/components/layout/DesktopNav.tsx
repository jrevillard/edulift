import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, User, Users, Home, Calendar, UserCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ConnectionIndicator } from "@/components/ConnectionIndicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const DesktopNav = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="container flex h-14 items-center justify-between">
        <nav className="flex items-center space-x-4">
          <Button variant="ghost" asChild>
            <Link to="/dashboard">
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/family/manage">
              <Users className="h-4 w-4 mr-2" />
              Manage Family
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/groups">
              <UserCheck className="h-4 w-4 mr-2" />
              Groups
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/schedule">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule
            </Link>
          </Button>
        </nav>
        
        <div className="flex items-center space-x-4">
          <ConnectionIndicator />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2" data-testid="DesktopNav-Container-userMenuTrigger">
                <User className="h-4 w-4" />
                <span data-testid="DesktopNav-Text-userName">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} data-testid="DesktopNav-Button-logout">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
