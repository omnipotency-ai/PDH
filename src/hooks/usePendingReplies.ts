import { useMutation, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "../../convex/_generated/api";

/**
 * Replaces the Zustand `drPooReplies` state with a Convex-backed query.
 *
 * Pending replies are user messages in the `conversations` table that have
 * no `aiAnalysisId` — they haven't been claimed by an analysis run yet.
 */
export function usePendingReplies() {
  const pendingReplies = useQuery(api.conversations.pendingReplies) ?? [];
  const addMessage = useMutation(api.conversations.addUserMessage);

  const addReply = useCallback(
    async (text: string) => {
      await addMessage({
        content: text,
        timestamp: Date.now(),
      });
    },
    [addMessage],
  );

  return { pendingReplies, addReply };
}
