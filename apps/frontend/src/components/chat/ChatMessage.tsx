import React from 'react';
import type { ChatMessage } from '../shared/chatConfig';
import { extractImageUrls, removeImageUrls } from '../shared/chatConfig';

const ChatMessage: React.FC<{ msg: ChatMessage; profile?: { name?: string; image?: string } }> = ({ msg, profile }) => {
  const imageUrls = extractImageUrls(msg.content);
  const cleanedText = removeImageUrls(msg.content, imageUrls);
  return (
    <div className="mb-2">
      <span className="font-bold text-xs text-gray-600">
        {profile?.name ? profile.name : msg.pubkey.slice(0, 8)}:
      </span> {cleanedText}
      {imageUrls.length > 0 && (
        <div className="flex flex-col gap-1 mt-1">
          {imageUrls.map(url => (
            <img key={url} src={url} alt="chat-img" className="max-h-32 max-w-full rounded border" />
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatMessage; 