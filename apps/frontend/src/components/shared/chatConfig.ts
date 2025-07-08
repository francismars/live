// Chat shared config and utils

export const GLOBAL_ROOM_EVENT_ID = 'f412192fdc846952c75058e911d37a7392aa7fd2e727330f4344badc92fb8a22';
export const GLOBAL_ROOM_RELAYS = [
  'wss://relay.nostr.band',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://relay.primal.net',
  'wss://offchain.pub',
  'wss://eden.nostr.land',
  'wss://nostr.mom',
  'wss://nostr-pub.wellorder.net'
];

export type ChatMessage = {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
};

export type ProfileMap = Record<string, { name?: string; image?: string }>;

export function extractImageUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/(?:[\w-]+\.)+[\w-]+(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?\.(?:jpg|jpeg|png|gif|webp))(\?[^\s]*)?/gi;
  const matches = text.match(urlRegex);
  return matches || [];
}

export function removeImageUrls(text: string, imageUrls: string[]): string {
  let result = text;
  imageUrls.forEach((url: string) => {
    result = result.replace(url, '').replace(/\s{2,}/g, ' ');
  });
  return result.trim();
}

export function hexToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return arr;
} 