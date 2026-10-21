import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ApiConversationSummary } from "../api/client";
import { useRequestScope } from "./useRequestScope";

// El id empieza con la fecha de creación (ISO): ordenar por id descendente es "más nueva primero".
const byNewest = (a: ApiConversationSummary, b: ApiConversationSummary) => (a.conversationId < b.conversationId ? 1 : a.conversationId > b.conversationId ? -1 : 0);

/**
 * Historial de conversaciones del asistente. Se pide una vez al abrir la vista (páginas de 20 con
 * "cargar más"); cuando el chat guarda, `upsert` actualiza la fila en pantalla sin volver a pedir la lista.
 */
export function useConversationList(idToken: string) {
  const scope = useRequestScope(idToken);
  // Renovar el JWT no debe volver a pedir la lista ni perder las páginas ya cargadas.
  const token = useRef(idToken);
  token.current = idToken;
  const [items, setItems] = useState<ApiConversationSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const task = scope.start("conversations");
    void (async () => {
      try {
        const { conversations, nextCursor: cursor } = await api.conversations(token.current, undefined, task.signal);
        if (!task.isCurrent()) return;
        // Lo que el chat guardó mientras tanto (upsert) no se pierde si la respuesta llega después.
        setItems((current) => {
          const known = new Set(conversations.map((c) => c.conversationId));
          return [...conversations, ...current.filter((c) => !known.has(c.conversationId))].sort(byNewest);
        });
        setNextCursor(cursor);
      } catch {
        if (task.isCurrent()) setError(true);
      } finally {
        if (task.isCurrent()) setLoaded(true);
        task.finish();
      }
    })();
  }, [scope]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    const task = scope.start("conversations-more");
    setLoadingMore(true);
    try {
      const { conversations, nextCursor: cursor } = await api.conversations(token.current, nextCursor, task.signal);
      if (!task.isCurrent()) return;
      setItems((current) => {
        const known = new Set(current.map((c) => c.conversationId));
        return [...current, ...conversations.filter((c) => !known.has(c.conversationId))].sort(byNewest);
      });
      setNextCursor(cursor);
    } catch {
      if (task.isCurrent()) setError(true);
    } finally {
      if (task.isCurrent()) setLoadingMore(false);
      task.finish();
    }
  }, [nextCursor, scope]);

  /** Alta o actualización de una fila (el chat acaba de guardar esa conversación). */
  const upsert = useCallback((summary: ApiConversationSummary) => {
    setItems((current) => [summary, ...current.filter((c) => c.conversationId !== summary.conversationId)].sort(byNewest));
  }, []);

  const remove = useCallback(async (conversationId: string) => {
    await api.deleteConversation(token.current, conversationId);
    setItems((current) => current.filter((c) => c.conversationId !== conversationId));
  }, []);

  return { items, loaded, error, hasMore: nextCursor !== undefined, loadingMore, loadMore, upsert, remove };
}
