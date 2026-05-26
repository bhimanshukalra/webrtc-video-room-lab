import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useSocket } from '../providers';
import { useNavigate } from 'react-router-dom';

const INPUT_CLASSNAME = 'text-2xl p-3 m-3 border';
const SESSION_STORAGE_EMAIL_ID_KEY = 'webrtc-video-room-email-id';

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
    const normalizedEmailId = emailId.trim();
    const normalizedRoomId = roomId.trim();

    if (!normalizedEmailId || !normalizedRoomId) {
      return;
    }

    window.sessionStorage.setItem(
      SESSION_STORAGE_EMAIL_ID_KEY,
      normalizedEmailId,
    );
    socket.emit('join-room', {
      emailId: normalizedEmailId,
      roomId: normalizedRoomId,
    });
  };

  const handleRoomJoined = useCallback(
    ({ roomId }: { roomId: string }) => {
      navigate(`/room/${roomId}`, {
        state: { emailId: emailId.trim(), hasJoinedRoom: true },
      });
    },
    [emailId, navigate],
  );

  useEffect(() => {
    socket.on('joined-room', handleRoomJoined);

    return () => {
      socket.off('joined-room', handleRoomJoined);
    };
  }, [handleRoomJoined, socket]);

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
