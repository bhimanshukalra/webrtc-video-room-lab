import { Route, Routes } from 'react-router-dom';
import { HomePage, RoomPage } from './pages';
import { AppProvider } from './providers';

function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path='/' element={<HomePage />} />
        <Route path='/room/:roomId' element={<RoomPage />} />
      </Routes>
    </AppProvider>
  );
}

export default App;
