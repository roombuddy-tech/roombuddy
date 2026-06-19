import { useEffect, useState } from 'react';

import { listConversations } from '../services/chat';

export function useUnreadMessages(intervalMs = 15000): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    const tick = async () => {
      try {
        const res = await listConversations();
        if (!active) return;
        const total = res.results.reduce((sum, c) => sum + (c.unread_count || 0), 0);
        setCount(total);
      } catch {
        // transient; next tick retries
      }
    };

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return count;
}