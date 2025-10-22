import { Home, Users, Calendar, LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ConnectionIndicator } from "@/components/ConnectionIndicator";

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const tabs = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: Users, label: "Family", path: "/family/manage" },
    { icon: Calendar, label: "Schedule", path: "/schedule" },
    { icon: LogOut, label: "Logout", path: null, action: handleLogout },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t">
      <div className="relative">
        {/* Connection indicator in top-right corner of mobile nav */}
        <div className="absolute top-1 right-2 z-10">
          <ConnectionIndicator className="scale-75" />
        </div>
        
        <div className="grid grid-cols-4 h-16">
          {tabs.map(({ icon: Icon, label, path, action }, index) => (
            <button
              key={path || `action-${index}`}
              onClick={() => path ? navigate(path) : action?.()}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-xs min-h-[44px]",
                path && location.pathname === path
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
              data-testid={path ? `BottomNav-Button-${label.toLowerCase()}` : `BottomNav-Button-${label.toLowerCase()}`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};
