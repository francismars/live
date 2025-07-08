import React, { useState } from 'react';
import { getPublicKey } from 'nostr-tools';

interface SignUpModalProps {
  show: boolean;
  onClose: () => void;
  publishProfile: (profileForm: any, priv: string, pub: string) => Promise<{ success: boolean; error?: string }>;
}

const initialProfileForm = {
  name: '',
  display_name: '',
  about: '',
  image: '',
  nip05: '',
  lud16: '',
  website: '',
  banner: '',
};

const SignUpModal: React.FC<SignUpModalProps> = ({ show, onClose, publishProfile }) => {
  const [registerStep, setRegisterStep] = useState<'form' | 'showKeys' | 'review' | 'publishing' | 'done'>('form');
  const [profileForm, setProfileForm] = useState({ ...initialProfileForm });
  const [generatedKeys, setGeneratedKeys] = useState<{ priv: string; pub: string } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  function generateNostrPrivateKey(): string {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function hexToUint8Array(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return arr;
  }

  const handleProfileFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProfileForm({ ...profileForm, [e.target.name]: e.target.value });
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.name.trim() || !profileForm.image.trim()) {
      return;
    }
    // Generate keypair
    const priv = generateNostrPrivateKey();
    const pub = getPublicKey(hexToUint8Array(priv));
    setGeneratedKeys({ priv, pub });
    setRegisterStep('showKeys');
  };

  const handleRegisterDone = () => {
    setRegisterStep('review');
  };

  const handlePublishProfile = async () => {
    if (!generatedKeys) return;
    setPublishing(true);
    setPublishError(null);
    const result = await publishProfile(profileForm, generatedKeys.priv, generatedKeys.pub);
    if (result.success) {
      setRegisterStep('done');
    } else {
      setPublishError(result.error || 'Failed to publish profile');
    }
    setPublishing(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-white text-black rounded-2xl shadow-2xl px-10 py-8 min-w-[340px] max-w-[90vw] relative flex flex-col items-center">
        <button className="absolute top-4 left-4 text-black hover:text-gray-700 text-2xl font-bold px-2 py-1 rounded-full focus:outline-none" onClick={() => { onClose(); setRegisterStep('form'); setGeneratedKeys(null); setProfileForm({ ...initialProfileForm }); }} aria-label="Back to sign in">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        {registerStep === 'form' && (
          <>
            <div className="text-2xl font-bold mb-6">Register</div>
            <form className="flex flex-col gap-3 w-full" onSubmit={handleRegisterSubmit}>
              <input className="px-3 py-2 rounded border" name="name" placeholder="Name *" value={profileForm.name} onChange={handleProfileFormChange} required style={{ borderColor: !profileForm.name.trim() ? 'red' : undefined }} />
              <input className="px-3 py-2 rounded border" name="display_name" placeholder="Display Name" value={profileForm.display_name} onChange={handleProfileFormChange} />
              <textarea className="px-3 py-2 rounded border" name="about" placeholder="About" value={profileForm.about} onChange={handleProfileFormChange} />
              <input className="px-3 py-2 rounded border" name="image" placeholder="Profile Picture URL *" value={profileForm.image} onChange={handleProfileFormChange} required style={{ borderColor: !profileForm.image.trim() ? 'red' : undefined }} />
              <input className="px-3 py-2 rounded border" name="banner" placeholder="Banner URL" value={profileForm.banner} onChange={handleProfileFormChange} />
              <input className="px-3 py-2 rounded border" name="nip05" placeholder="NIP-05 (e.g. alice@nostr.com)" value={profileForm.nip05} onChange={handleProfileFormChange} />
              <input className="px-3 py-2 rounded border" name="lud16" placeholder="Lightning Address (lud16)" value={profileForm.lud16} onChange={handleProfileFormChange} />
              <input className="px-3 py-2 rounded border" name="website" placeholder="Website" value={profileForm.website} onChange={handleProfileFormChange} />
              <button type="submit" className="mt-4 px-6 py-2 rounded bg-black text-white hover:bg-gray-900 transition font-bold" disabled={!profileForm.name.trim() || !profileForm.image.trim()}>Generate Keys & Continue</button>
              <div className="text-xs text-red-600 mt-1">* Name and Profile Picture URL are required</div>
            </form>
          </>
        )}
        {registerStep === 'showKeys' && generatedKeys && (
          <>
            <div className="text-2xl font-bold mb-4">Backup Your Keys</div>
            <div className="mb-2 text-sm text-gray-700">Save your private key somewhere safe. You will need it to log in again. <span className="text-red-600 font-bold">Do not share it!</span></div>
            <div className="w-full break-all bg-gray-100 rounded p-2 mb-2"><b>Public Key:</b><br />{generatedKeys.pub}</div>
            <div className="w-full break-all bg-yellow-100 rounded p-2 mb-4"><b>Private Key:</b><br />{generatedKeys.priv}</div>
            <button className="mt-2 px-6 py-2 rounded bg-black text-white hover:bg-gray-900 transition font-bold" onClick={handleRegisterDone}>I have backed up my keys</button>
          </>
        )}
        {registerStep === 'review' && generatedKeys && (
          <>
            <div className="text-2xl font-bold mb-4">Review Profile</div>
            <div className="flex flex-col items-center w-full gap-2 mb-4">
              <img src={profileForm.image} alt="Profile" className="w-24 h-24 rounded-full object-cover border-2 border-black" />
              <div className="font-bold text-lg">{profileForm.name}</div>
              {profileForm.display_name && <div className="text-gray-700">{profileForm.display_name}</div>}
              {profileForm.about && <div className="text-gray-600 text-center">{profileForm.about}</div>}
              {profileForm.banner && <img src={profileForm.banner} alt="Banner" className="w-full max-w-xs h-16 object-cover rounded" />}
              {profileForm.nip05 && <div className="text-xs text-gray-400">NIP-05: {profileForm.nip05}</div>}
              {profileForm.lud16 && <div className="text-xs text-gray-400">Lightning: {profileForm.lud16}</div>}
              {profileForm.website && <div className="text-xs text-blue-600 underline">{profileForm.website}</div>}
            </div>
            <button className="mt-2 px-6 py-2 rounded bg-black text-white hover:bg-gray-900 transition font-bold" onClick={handlePublishProfile} disabled={publishing}>Confirm & Publish to Nostr</button>
            <button className="mt-2 px-6 py-2 rounded bg-gray-200 text-black hover:bg-gray-300 transition font-bold" onClick={() => setRegisterStep('form')}>Edit</button>
            {publishError && <div className="text-red-600 mt-2">{publishError}</div>}
          </>
        )}
        {registerStep === 'publishing' && (
          <div className="text-lg font-bold">Publishing profile to Nostr...</div>
        )}
        {registerStep === 'done' && (
          <>
            <div className="text-2xl font-bold mb-4">Profile Published!</div>
            <div className="mb-4">Your profile has been published to Nostr. You can now use your account.</div>
            <button className="mt-2 px-6 py-2 rounded bg-black text-white hover:bg-gray-900 transition font-bold" onClick={() => { onClose(); setRegisterStep('form'); setGeneratedKeys(null); setProfileForm({ ...initialProfileForm }); }}>Close</button>
          </>
        )}
      </div>
    </div>
  );
};

export default SignUpModal; 