import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useSocket } from '../providers';
import { useNavigate } from 'react-router-dom';

const INPUT_CLASSNAME = 'text-2xl p-3 m-3 border';

export const HomePage = () => {
  const { socket } = useSocket();

  const [emailId, setEmailId] = useState('');
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmailId(event.target.value);
  };

  const handleRoomIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    setRoomId(event.target.value);
  };

  const handleJoinRoom = () => {
    socket.emit('join-room', { emailId, roomId });
  };

  const handleRoomJoined = useCallback(
    ({ roomId }: { roomId: string }) => {
      navigate(`/room/${roomId}`, { state: { emailId } });
    },
    [emailId, navigate],
  );

  useEffect(() => {
    socket.on('joined-room', handleRoomJoined);

    return () => {
      socket.off('joined-room', handleRoomJoined);
    };
  }, [socket]);

  return (
    <div className='flex items-center justify-center h-screen flex-col'>
      <input
        type='email'
        placeholder='Enter your email here'
        className={INPUT_CLASSNAME}
        value={emailId}
        onChange={handleEmailChange}
      />
      <input
        type='text'
        placeholder='Enter room code'
        className={INPUT_CLASSNAME}
        value={roomId}
        onChange={handleRoomIdChange}
      />
      <button
        onClick={handleJoinRoom}
        className='text-2xl p-3 m-3 bg-black text-white cursor-pointer'
      >
        Enter Room
      </button>
    </div>
  );
};
