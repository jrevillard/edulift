import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";
import { Users, Home, Calendar, UserCheck, User } from "lucide-react";

export const MobileNav = ({ onNavigate }: { onNavigate: () => void }) => {
  return (
    <nav className="flex flex-col space-y-2 p-4">
      <SheetClose asChild>
        <Button variant="ghost" asChild>
          <Link to="/dashboard" onClick={onNavigate} className="flex items-center">
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Link>
        </Button>
      </SheetClose>
      <SheetClose asChild>
        <Button variant="ghost" asChild>
          <Link to="/family/manage" onClick={onNavigate} className="flex items-center">
            <Users className="h-4 w-4 mr-2" />
            Manage Family
          </Link>
        </Button>
      </SheetClose>
      <SheetClose asChild>
        <Button variant="ghost" asChild>
          <Link to="/groups" onClick={onNavigate} className="flex items-center">
            <UserCheck className="h-4 w-4 mr-2" />
            Groups
          </Link>
        </Button>
      </SheetClose>
      <SheetClose asChild>
        <Button variant="ghost" asChild>
          <Link to="/schedule" onClick={onNavigate} className="flex items-center">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule
          </Link>
        </Button>
      </SheetClose>
      <SheetClose asChild>
        <Button variant="ghost" asChild>
          <Link to="/profile" onClick={onNavigate} className="flex items-center">
            <User className="h-4 w-4 mr-2" />
            Profile
          </Link>
        </Button>
      </SheetClose>
    </nav>
  );
};
