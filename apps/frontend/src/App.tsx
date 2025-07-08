import './App.css'
import MainMenu from './components/menu/MainMenu'
import { BrowserRouter } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <MainMenu />
    </BrowserRouter>
  );
}

export default App
