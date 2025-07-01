import React from 'react';

interface MainMenuOptionsProps {
  onPlay: () => void;
  hide: boolean;
}

const MainMenuOptions: React.FC<MainMenuOptionsProps> = ({ onPlay, hide }) => (
  <div
    className={`absolute bottom-28 left-12 flex flex-col gap-4 items-start z-10 transition-all duration-500 ${
      hide ? '-translate-x-32 opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'
    }`}
  >
    <button
      className="px-8 py-3 text-lg font-semibold bg-white text-black rounded-full shadow hover:bg-gray-200 transition"
      onClick={onPlay}
    >
      Play
    </button>
    <button className="px-8 py-3 text-lg font-semibold bg-white text-black rounded-full shadow hover:bg-gray-200 transition">Watch</button>
    <button className="px-8 py-3 text-lg font-semibold bg-white text-black rounded-full shadow hover:bg-gray-200 transition">Shop</button>
    <button className="px-8 py-3 text-lg font-semibold bg-white text-black rounded-full shadow hover:bg-gray-200 transition">About</button>
  </div>
);

export default MainMenuOptions; 