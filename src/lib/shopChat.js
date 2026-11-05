/**
 * shopChat.js — shop side of the customer <-> shop chat (marketplace-service
 * ShopChatController), the same calls the Partner app's src/api/chat.js makes:
 *
 *   GET  /shop/chats                         threads (ChatThreadResponse)
 *   GET  /shop/chats/{id}                    one thread
 *   GET  /shop/chats/{id}/messages           messages (ChatMessageResponse)
 *   POST /shop/chats/{id}/messages           { body, attachmentUrl?, attachmentType? }
 *   POST /shop/chats/{id}/read               zero unread for the shop
 *   POST /shop/chats/{id}/typing             { typing }
 *   POST /shop/chats/presence                ping last_seen_at
 */

import { MARKETPLACE_BASE } from '@/lib/api';
import { shopRequest } from '@/lib/shopApi';

const list = (v) => (Array.isArray(v) ? v : v?.content ?? v?.data ?? []);
const post = (path, body = {}) => shopRequest(MARKETPLACE_BASE(), path, { method: 'POST', body: JSON.stringify(body) });

export async function listShopChats() {
  return list(await shopRequest(MARKETPLACE_BASE(), '/shop/chats'));
}

export async function getShopChat(threadId) {
  return shopRequest(MARKETPLACE_BASE(), `/shop/chats/${encodeURIComponent(threadId)}`);
}

export async function getShopChatMessages(threadId) {
  return list(await shopRequest(MARKETPLACE_BASE(), `/shop/chats/${encodeURIComponent(threadId)}/messages`));
}

export async function sendShopChatMessage(threadId, { body, attachmentUrl, attachmentType } = {}) {
  return post(`/shop/chats/${encodeURIComponent(threadId)}/messages`, { body, attachmentUrl, attachmentType });
}

export async function markShopChatRead(threadId) {
  return post(`/shop/chats/${encodeURIComponent(threadId)}/read`);
}

export async function pingShopTyping(threadId, typing) {
  return post(`/shop/chats/${encodeURIComponent(threadId)}/typing`, { typing: Boolean(typing) });
}

export async function pingShopPresence() {
  return post('/shop/chats/presence');
}
