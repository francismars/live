import { useEffect, useState } from 'react';
import type { ProfileMap } from './chatConfig';
import fetchNostrProfile from './nostrProfile';

export default function useNostrProfiles(pubkeys: string[]): ProfileMap {
  const [profiles, setProfiles] = useState<ProfileMap>({});

  useEffect(() => {
    const uniquePubkeys = Array.from(new Set(pubkeys));
    uniquePubkeys.forEach(pubkey => {
      if (!profiles[pubkey]) {
        fetchNostrProfile(pubkey).then(profile => {
          setProfiles(prev => ({ ...prev, [pubkey]: profile }));
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkeys]);

  return profiles;
} 