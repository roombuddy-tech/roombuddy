import { ENDPOINTS } from '../constants/endpoints';
import type {
    ChatMessage,
    Conversation,
    ConversationListResponse,
    MessageListResponse,
} from '../types/chat';
import api from './api';

/** List the current user's conversations (guest or host side), newest first. */
export async function listConversations(): Promise<ConversationListResponse> {
  const res = await api.get<ConversationListResponse>(ENDPOINTS.CHAT.CONVERSATIONS);
  return res.data;
}

/** Get-or-create the conversation for a booking. Returns the thread to open. */
export async function startConversation(bookingId: string): Promise<Conversation> {
  const res = await api.post<Conversation>(ENDPOINTS.CHAT.CONVERSATIONS, {
    booking_id: bookingId,
  });
  return res.data;
}

/** Fetch messages in a thread. Pass `after` (ISO timestamp) to poll incrementally. */
export async function getMessages(
  conversationId: string,
  after?: string,
): Promise<MessageListResponse> {
  const res = await api.get<MessageListResponse>(
    ENDPOINTS.CHAT.MESSAGES(conversationId),
    after ? { params: { after } } : undefined,
  );
  return res.data;
}

/** Send a text message; returns the created message. */
export async function sendMessage(
  conversationId: string,
  body: string,
): Promise<ChatMessage> {
  const res = await api.post<ChatMessage>(ENDPOINTS.CHAT.MESSAGES(conversationId), {
    body,
  });
  return res.data;
}

/** Mark the thread read up to now for the current user. */
export async function markConversationRead(conversationId: string): Promise<void> {
  await api.post(ENDPOINTS.CHAT.READ(conversationId));
}
