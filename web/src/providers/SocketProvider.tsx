import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketProviderProps {
  children: ReactNode;
}

interface SocketContextValue {
  socket: Socket;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export const useSocket = () => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error('useSocket must be used inside SocketProvider');
  }

  return context;
};

export const SocketProvider = ({ children }: SocketProviderProps) => {
  const socket = useMemo(() => io('http://localhost:8001'), []);

  return (
    // TODO: check if it's better to pass socket directly, instead of passing inside an object
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
