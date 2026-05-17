import { useEffect } from 'react';
import { useSocket } from '../providers';

export const RoomPage = () => {
  const { socket } = useSocket();

  const handleNewUserJoined = ({ emailId }: { emailId: string }) => {
    console.log('new user joined room', emailId);
  };

  useEffect(() => {
    socket.on('user-joined', handleNewUserJoined);

    return () => {
      socket.off('user-joined', handleNewUserJoined);
    };
  }, [socket]);

  return (
    <div>
      <h1>Room page</h1>
    </div>
  );
};
