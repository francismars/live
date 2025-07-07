import NDK, { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';

const ndk = new NDK({
  explicitRelayUrls: ["wss://relay.nostr.band", "wss://relay.damus.io"]
});
ndk.connect();

async function fetchNostrProfile(pubkey: string): Promise<{ image?: string; name?: string; about?: string; nip05?: string; lud16?: string; }> {
  try {
    const events = await ndk.fetchEvents({
      kinds: [NDKKind.Metadata],
      authors: [pubkey],
      limit: 1
    });
    const event = Array.from(events)[0] as NDKEvent | undefined;
    if (!event) return {};
    const content = JSON.parse(event.content);
    return {
      image: content.picture,
      name: content.name,
      about: content.about,
      nip05: content.nip05,
      lud16: content.lud16
    };
  } catch {
    return {};
  }
}

export default fetchNostrProfile;
export { ndk }; 