import { useMemo, useState } from "react";
import type { ApiConversationSummary } from "../../api/client";
import { groupConversations } from "../../lib/conversation";
import { IconPlus } from "../icons";

export function IconSidebar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9 4v16" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" />
    </svg>
  );
}

interface ConversationSidebarProps {
  open: boolean;
  items: ApiConversationSummary[];
  loaded: boolean;
  error: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  activeId: string | null;
  onClose: () => void;
  onNew: () => void;
  onOpen: (conversationId: string) => void;
  onDelete: (conversationId: string) => Promise<void>;
  onLoadMore: () => void;
}

/** Historial de conversaciones del asistente: lista agrupada por día, con abrir, borrar y "cargar más". */
export function ConversationSidebar({ open, items, loaded, error, hasMore, loadingMore, activeId, onClose, onNew, onOpen, onDelete, onLoadMore }: ConversationSidebarProps) {
  const groups = useMemo(() => groupConversations(items), [items]);
  const [deleteError, setDeleteError] = useState(false);

  async function remove(item: ApiConversationSummary) {
    if (!window.confirm(`¿Borrar la conversación "${item.title}"? No se puede deshacer.`)) return;
    setDeleteError(false);
    try {
      await onDelete(item.conversationId);
    } catch {
      setDeleteError(true);
    }
  }

  return (
    <>
      {open && <div className="ai-side-scrim" onClick={onClose} />}
      <aside className={`ai-chat-side${open ? " open" : ""}`} aria-label="Historial de conversaciones" aria-hidden={!open}>
        <button type="button" className="ai-side-new" onClick={onNew}><IconPlus />Nueva conversación</button>
        <div className="ai-side-list">
          {!loaded && <div className="ai-side-note">Cargando…</div>}
          {loaded && items.length === 0 && <div className="ai-side-note">{error ? "No se pudo cargar el historial." : "Aún no tienes conversaciones."}</div>}
          {deleteError && <div className="ai-side-note" role="alert">No se pudo borrar, probá de nuevo.</div>}
          {groups.map((group) => (
            <section key={group.label}>
              <h3>{group.label}</h3>
              {group.items.map((item) => (
                <div className={`ai-side-item${item.conversationId === activeId ? " active" : ""}`} key={item.conversationId}>
                  <button type="button" className="ai-side-open" onClick={() => onOpen(item.conversationId)} title={item.title} aria-current={item.conversationId === activeId ? "true" : undefined}>{item.title}</button>
                  <button type="button" className="ai-side-del" onClick={() => void remove(item)} aria-label={`Borrar la conversación "${item.title}"`} title="Borrar"><IconTrash /></button>
                </div>
              ))}
            </section>
          ))}
          {hasMore && <button type="button" className="ai-side-more" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? "Cargando…" : "Cargar más"}</button>}
        </div>
      </aside>
    </>
  );
}
