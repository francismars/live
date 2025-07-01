import React, { useRef, useEffect } from 'react';

interface UserDropdownProps {
  show: boolean;
  onClose: () => void;
  onLogout: () => void;
}

const UserDropdown: React.FC<UserDropdownProps> = ({ show, onClose, onLogout }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (show) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div ref={ref} className="absolute top-16 right-0 mt-2 w-56 bg-white text-black rounded-xl shadow-xl z-50 py-2 flex flex-col">
      <button className="text-left px-6 py-3 hover:bg-gray-100 transition" onClick={onClose}>View Profile</button>
      <button className="text-left px-6 py-3 hover:bg-gray-100 transition" onClick={onClose}>MMR / Stats</button>
      <button className="text-left px-6 py-3 hover:bg-gray-100 transition" onClick={onClose}>Balance</button>
      <button className="text-left px-6 py-3 hover:bg-gray-100 transition" onClick={onClose}>Settings</button>
      <button className="text-left px-6 py-3 hover:bg-gray-100 transition text-red-600 font-semibold" onClick={onLogout}>Logout</button>
    </div>
  );
};

export default UserDropdown; 