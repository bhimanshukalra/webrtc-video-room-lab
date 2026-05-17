import { Route, Routes } from 'react-router-dom';
import { HomePage, RoomPage } from './pages';
import { SocketProvider } from './providers';

function App() {
  return (
    <SocketProvider>
      <Routes>
        <Route path='/' element={<HomePage />} />
        <Route path='/room/:roomId' element={<RoomPage />} />
      </Routes>
    </SocketProvider>
  );
}

export default App;
