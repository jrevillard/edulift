import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { MobileNav } from "@/components/layout/MobileNav";
import { DesktopNav } from "@/components/layout/DesktopNav";
import { BottomNav } from "@/components/layout/BottomNav";
import { ConnectionIndicator } from "@/components/ConnectionIndicator";

export const ResponsiveLayout: React.FC<{ 
  children: React.ReactNode;
  fullWidth?: boolean;
}> = ({
  children,
  fullWidth = false,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      {isMobile ? (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
          <div className="container flex h-14 items-center">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px]">
                <MobileNav onNavigate={() => setMobileMenuOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="ml-4 flex items-center gap-2">
              <img
                src="/logo-32.png"
                alt="EduLift"
                className="w-6 h-6 object-contain"
              />
              <h1 className="text-lg font-semibold">EduLift</h1>
            </div>
            <div className="ml-auto">
              <ConnectionIndicator />
            </div>
          </div>
        </header>
      ) : (
        <DesktopNav />
      )}

      {/* Main Content */}
      <main
        className={cn(
          fullWidth ? "w-full" : "container mx-auto",
          isMobile ? "px-4 py-4" : "px-8 py-6"
        )}
      >
        {children}
      </main>

      {/* Bottom Navigation for Mobile */}
      {isMobile && <BottomNav />}
    </div>
  );
};
