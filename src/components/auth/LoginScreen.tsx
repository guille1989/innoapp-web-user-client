import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { describeAuthError } from "../../auth/cognito";

interface LoginScreenProps {
  onSwitchToSignup: () => void;
}

export function LoginScreen({ onSwitchToSignup }: LoginScreenProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-story" aria-label="Presentación de InnoApp">
        <div className="login-grid" />
        <div className="login-glow login-glow-top" />
        <div className="login-glow login-glow-bottom" />
        <div className="login-brand">
          <img src="/brand/innoapp-mark.png" alt="" />
          <div>
            <strong>Inno<span>App</span></strong>
            <small>Simple and Efficient</small>
          </div>
        </div>
        <div className="login-copy">
          <span className="eyebrow">Inteligencia operativa</span>
          <h1>Convierte cada ticket en una decisión.</h1>
          <p>Conecta tus puntos de venta, supervisa tus agentes y entiende el negocio en tiempo real.</p>
          <div className="login-features">
            <span><i /> Datos en tiempo real</span>
            <span><i /> Agentes monitorizados</span>
            <span><i /> Dashboards a medida</span>
          </div>
        </div>
        <div className="login-security">Acceso seguro · AWS Cognito</div>
      </section>

      <section className="login-form-side">
        <div className="login-form-wrap">
          <div className="form-logo"><img src="/brand/innoapp-mark.png" alt="" /><strong>Inno<span>App</span></strong></div>
          <div className="login-heading">
            <h2>Bienvenido de vuelta</h2>
            <p>Ingresa tus credenciales para continuar.</p>
          </div>
          <form onSubmit={handleSubmit}>
            <label className="login-field" htmlFor="loginEmail">
              <span>Correo electrónico</span>
              <div className="login-input-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
                <input id="loginEmail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} placeholder="usuario@empresa.com" />
              </div>
            </label>
            <label className="login-field" htmlFor="loginPassword">
              <span>Contraseña</span>
              <div className="login-input-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
                <input id="loginPassword" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting} placeholder="••••••••••" />
                <button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
            </label>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="login-submit" type="submit" disabled={submitting}>
              {submitting ? <><span className="spinner" /> Verificando…</> : <>Iniciar sesión <span>→</span></>}
            </button>
          </form>
          <p className="login-help">Las sesiones se renuevan automáticamente mientras trabajas.</p>
          <p className="login-help">
            ¿No tenés cuenta?{" "}
            <button type="button" className="login-switch" onClick={onSwitchToSignup} disabled={submitting}>Registrate</button>
          </p>
        </div>
        <footer>© 2026 InnoApp · Todos los derechos reservados</footer>
      </section>
    </main>
  );
}
