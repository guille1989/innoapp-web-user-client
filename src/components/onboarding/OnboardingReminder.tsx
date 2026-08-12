interface OnboardingReminderProps {
  connected: boolean;
  hasTickets: boolean;
  hasWidgets: boolean;
  onContinue: () => void;
}

export function OnboardingReminder({ connected, hasTickets, hasWidgets, onContinue }: OnboardingReminderProps) {
  const completed = [connected, hasTickets, hasWidgets].filter(Boolean).length;
  const next = !connected ? "Conecta tu primer agente" : !hasTickets ? "Recibe tu primer ticket" : "Prepara tu dashboard";
  return (
    <aside className="onboarding-reminder glass" aria-label="Configuración pendiente">
      <div className="onboarding-reminder-progress"><span style={{ width: `${completed / 3 * 100}%` }} /></div>
      <div><small>Configuración · {completed}/3</small><strong>{next}</strong></div>
      <button onClick={onContinue}>Continuar <span>→</span></button>
    </aside>
  );
}
