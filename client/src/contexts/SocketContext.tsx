import { createContext, useContext, useEffect, ReactNode } from "react";
import { socketService } from "@/lib/socket";
import { useAuth } from "./AuthContext";

interface SocketContextType {
  socket: typeof socketService;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      socketService.connect(user.role);
    }

    return () => {
      socketService.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket: socketService }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context.socket;
}
