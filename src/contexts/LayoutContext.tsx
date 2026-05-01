import React, { createContext, useContext, useState } from 'react';

interface LayoutContextType {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isDesktopCollapsed: boolean;
  setIsDesktopCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  const toggleSidebar = () => {
    // If mobile, toggle open/close
    // If desktop, toggle collapse
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(!isSidebarOpen);
    } else {
      setIsDesktopCollapsed(!isDesktopCollapsed);
    }
  };

  return (
    <LayoutContext.Provider value={{ 
      isSidebarOpen, 
      setIsSidebarOpen, 
      isDesktopCollapsed,
      setIsDesktopCollapsed,
      toggleSidebar 
    }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}

