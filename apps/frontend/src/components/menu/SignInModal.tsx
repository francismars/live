import React from 'react';

interface SignInModalProps {
  show: boolean;
  onClose: () => void;
  onExtensionSignIn: () => void;
}

const SignInModal: React.FC<SignInModalProps> = ({ show, onClose, onExtensionSignIn }) => (
  <div
    className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 transition-all duration-500 ${
      show ? 'scale-100 opacity-100' : 'scale-75 opacity-0 pointer-events-none'
    }`}
  >
    <div className="bg-white text-black rounded-2xl shadow-2xl px-12 py-10 flex flex-col gap-6 items-center min-w-[320px] relative">
      <button
        className="absolute top-4 left-4 text-black hover:text-gray-700 text-2xl font-bold px-2 py-1 rounded-full focus:outline-none"
        onClick={onClose}
        aria-label="Close sign in modal"
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </button>
      <div className="text-2xl font-bold mb-4">Sign In</div>
      <button className="w-full py-3 px-6 text-lg font-semibold rounded-full bg-black text-white hover:bg-gray-900 transition" onClick={onExtensionSignIn}>Extension</button>
      <button className="w-full py-3 px-6 text-lg font-semibold rounded-full bg-black text-white hover:bg-gray-900 transition">Key</button>
      <button className="w-full py-3 px-6 text-lg font-semibold rounded-full bg-gray-200 text-black hover:bg-gray-300 transition mt-2">Register</button>
    </div>
  </div>
);

export default SignInModal; 