import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiConversationSummary } from "../../api/client";
import { filterConversations, formatConversationTime, groupConversations } from "../../lib/conversation";
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

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

// En pantallas angostas el historial es un panel que se superpone al chat.
const isNarrow = () => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches;

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

/**
 * Historial de conversaciones del asistente: búsqueda, lista agrupada por día, abrir, borrar y "cargar más".
 * En escritorio se pliega a un costado; en móvil es un cajón sobre el chat que se cierra con su botón, tocando fuera o con Escape.
 */
export function ConversationSidebar({ open, items, loaded, error, hasMore, loadingMore, activeId, onClose, onNew, onOpen, onDelete, onLoadMore }: ConversationSidebarProps) {
  const [query, setQuery] = useState("");
  const [deleteError, setDeleteError] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const visible = useMemo(() => filterConversations(items, query), [items, query]);
  const groups = useMemo(() => groupConversations(visible), [visible]);
  const searching = query.trim() !== "";

  // Como cajón (móvil): el foco entra al panel al abrirse y Escape lo cierra.
  // onClose llega como flecha nueva en cada render: va por ref para no volver a enfocar el botón cada vez.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open || !isNarrow()) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCloseRef.current(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

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
      {open && <div className="ai-side-scrim" onClick={onClose} aria-hidden="true" />}
      {/* Cerrado queda con visibility:hidden (CSS): fuera del orden de tabulación y del lector de pantalla. */}
      <aside className={`ai-chat-side${open ? " open" : ""}`} aria-label="Historial de conversaciones">
        <div className="ai-side-inner">
          <div className="ai-side-head">
            <h2>Conversaciones</h2>
            <button type="button" ref={closeRef} className="ai-side-close" onClick={onClose} aria-label="Ocultar el historial" title="Ocultar el historial"><IconSidebar /></button>
          </div>
          <button type="button" className="ai-side-new" onClick={onNew}><IconPlus />Nueva conversación</button>
          {items.length > 0 && (
            <label className="ai-side-search">
              <IconSearch />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar conversaciones" aria-label="Buscar conversaciones" />
            </label>
          )}
          <div className="ai-side-list">
            {!loaded && <div className="ai-side-note">Cargando…</div>}
            {loaded && items.length === 0 && <div className="ai-side-note">{error ? "No se pudo cargar el historial." : "Aún no tienes conversaciones."}</div>}
            {deleteError && <div className="ai-side-note" role="alert">No se pudo borrar, probá de nuevo.</div>}
            {searching && items.length > 0 && visible.length === 0 && (
              <div className="ai-side-empty">
                <strong>Sin resultados</strong>
                <p>No hay conversaciones con “{query.trim()}”.</p>
                <button type="button" onClick={() => setQuery("")}>Limpiar búsqueda</button>
              </div>
            )}
            {groups.map((group) => (
              <section key={group.label}>
                <h3>{group.label}</h3>
                {group.items.map((item) => (
                  <div className={`ai-side-item${item.conversationId === activeId ? " active" : ""}`} key={item.conversationId}>
                    <button type="button" className="ai-side-open" onClick={() => onOpen(item.conversationId)} title={item.title} aria-current={item.conversationId === activeId ? "true" : undefined}>
                      <span className="ai-side-title">{item.title}</span>
                      <time dateTime={item.createdAt}>{formatConversationTime(item.createdAt)}</time>
                    </button>
                    <button type="button" className="ai-side-del" onClick={() => void remove(item)} aria-label={`Borrar la conversación "${item.title}"`} title="Borrar"><IconTrash /></button>
                  </div>
                ))}
              </section>
            ))}
            {hasMore && (
              <button type="button" className="ai-side-more" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? "Cargando…" : "Cargar más"}</button>
            )}
            {hasMore && searching && <div className="ai-side-note">La búsqueda recorre solo las conversaciones ya cargadas.</div>}
          </div>
        </div>
      </aside>
    </>
  );
}
