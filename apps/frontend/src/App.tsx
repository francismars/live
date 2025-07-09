import './App.css'
import MainMenu from './components/menu/MainMenu'
import GamePage from './components/game/GamePage'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/join/:roomId" element={<MainMenu />} />
        <Route path="/game/:roomId" element={<GamePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App
