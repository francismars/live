import { useState, useEffect, useCallback } from 'react';
import fetchNostrProfile, { ndk } from './nostrProfile';
import { nip19, getPublicKey, finalizeEvent } from 'nostr-tools';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import type { UserProfile } from '../../types/profile';

const PUBKEY_KEY = 'cdl_pubkey';
const IMAGE_KEY = 'cdl_image';
const PROFILE_KEY = 'cdl_profile';

type AuthMethod = 'extension' | 'key' | null;

function hexToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return arr;
}

export default function useNostrAuth() {
  const [userPubkey, setUserPubkey] = useState<string | null>(null);
  const [userPrivkey, setUserPrivkey] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userImage, setUserImage] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);

  // Restore login state on mount
  useEffect(() => {
    const savedPubkey = localStorage.getItem(PUBKEY_KEY);
    const savedImage = localStorage.getItem(IMAGE_KEY);
    const savedProfile = localStorage.getItem(PROFILE_KEY);
    if (savedPubkey) setUserPubkey(savedPubkey);
    if (savedImage) setUserImage(savedImage);
    if (savedProfile) setUserProfile(JSON.parse(savedProfile));
  }, []);

  // Persist login state when it changes
  useEffect(() => {
    if (userPubkey) {
      localStorage.setItem(PUBKEY_KEY, userPubkey);
      if (userImage) {
        localStorage.setItem(IMAGE_KEY, userImage);
      }
      if (userProfile) {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(userProfile));
      }
    } else {
      localStorage.removeItem(PUBKEY_KEY);
      localStorage.removeItem(IMAGE_KEY);
      localStorage.removeItem(PROFILE_KEY);
    }
  }, [userPubkey, userImage, userProfile]);

  const signOut = useCallback(() => {
    setUserPubkey(null);
    setUserImage(null);
    setUserProfile(null);
    setUserPrivkey(null);
    setAuthMethod(null);
    localStorage.removeItem(PUBKEY_KEY);
    localStorage.removeItem(IMAGE_KEY);
    localStorage.removeItem(PROFILE_KEY);
  }, []);

  const signInWithExtension = useCallback(async () => {
    if (window.nostr && window.nostr.getPublicKey) {
      try {
        const pubkey = await window.nostr.getPublicKey();
        setUserPubkey(pubkey);
        const profile = await fetchNostrProfile(pubkey);
        if (profile.image) setUserImage(profile.image);
        setUserProfile(profile);
        setUserPrivkey(null);
        setAuthMethod('extension');
        return { success: true };
      } catch (e) {
        return { success: false, error: 'Failed to sign in with extension.' };
      }
    } else {
      return { success: false, error: 'Nostr extension not found.' };
    }
  }, []);

  const signInWithKey = useCallback(async (key: string) => {
    try {
      let privkey = key;
      if (key.startsWith('nsec')) {
        privkey = nip19.decode(key).data as string;
      }
      const pubkey = getPublicKey(hexToUint8Array(privkey));
      setUserPubkey(pubkey);
      setUserPrivkey(privkey);
      setAuthMethod('key');
      const profile = await fetchNostrProfile(pubkey);
      if (profile.image) setUserImage(profile.image);
      setUserProfile(profile);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Invalid key or failed to fetch profile.' };
    }
  }, []);

  const publishProfile = useCallback(async (profileForm: UserProfile, priv: string, pub: string) => {
    try {
      const unsignedEvent = {
        kind: 0,
        content: JSON.stringify(profileForm),
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        pubkey: pub,
      };
      const signedEvent = finalizeEvent(unsignedEvent, hexToUint8Array(priv));
      const ndkEvent = new NDKEvent(ndk, signedEvent);
      await ndkEvent.publish();
      setUserPubkey(pub);
      setUserPrivkey(priv);
      setAuthMethod('key');
      // Fetch the profile from Nostr to get the image as relays see it
      const fetchedProfile = await fetchNostrProfile(pub);
      setUserImage((fetchedProfile.image || profileForm.image) ?? null);
      // Merge the form and fetched profile, always set image
      const fetched: Partial<UserProfile> = fetchedProfile || {};
      const form: UserProfile = profileForm;
      setUserProfile({
        name: fetched.name ?? form.name ?? '',
        display_name: fetched.display_name ?? form.display_name ?? '',
        about: fetched.about ?? form.about ?? '',
        image: fetched.image ?? form.image ?? '',
        nip05: fetched.nip05 ?? form.nip05 ?? '',
        lud16: fetched.lud16 ?? form.lud16 ?? '',
        website: fetched.website ?? form.website ?? '',
        banner: fetched.banner ?? form.banner ?? '',
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Failed to publish profile.' };
    }
  }, []);

  return {
    userPubkey,
    userPrivkey,
    userProfile,
    userImage,
    authMethod,
    signInWithExtension,
    signInWithKey,
    publishProfile,
    signOut,
    setUserProfile,
    setUserImage,
    setUserPrivkey,
    setAuthMethod,
  };
} 