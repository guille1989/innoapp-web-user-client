interface OverlayProps {
  open: boolean;
  onClick: () => void;
}

export function Overlay({ open, onClick }: OverlayProps) {
  return <div className={`sheet-overlay${open ? " open" : ""}`} onClick={onClick} />;
}
