export interface ChatMessage {
  id: string;
  body: string;
  sender_id: string;
  is_mine: boolean;
  created_at: string;
}

export interface Conversation {
  conversation_id: string;
  booking_id: string | null;
  booking_code: string | null;
  booking_status: string | null;
  is_inquiry: boolean;
  chat_disabled: boolean;
  counterpart_name: string;
  counterpart_initials: string;
  last_message: string | null;
  listing_id: string | null;
  listing_title: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface ConversationListResponse {
  count: number;
  results: Conversation[];
}

export interface MessageListResponse {
  conversation_id: string;
  count: number;
  results: ChatMessage[];
}
