import React from 'react';

interface UserAvatarButtonProps {
  onClick?: () => void;
  imageUrl?: string;
}

const UserAvatarButton: React.FC<UserAvatarButtonProps> = ({ onClick, imageUrl }) => (
  <button
    className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg focus:outline-none border-2 border-transparent hover:border-black hover:bg-gray-100 transition overflow-hidden"
    onClick={onClick}
    aria-label="Sign in"
    type="button"
  >
    {imageUrl ? (
      <img src={imageUrl} alt="User avatar" className="w-full h-full object-cover rounded-full" />
    ) : (
      <span className="material-symbols-outlined text-black text-4xl">account_circle</span>
    )}
  </button>
);

export default UserAvatarButton; 