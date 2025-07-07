import React from 'react';

const ChatButton: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
  <button
    className="absolute bottom-8 right-12 w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:bg-gray-200 transition z-20"
    onClick={onClick}
  >
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.8l-4 1 1-3.6A7.963 7.963 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
  </button>
);

export default ChatButton; 