import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { describeAuthError } from "../../auth/cognito";

interface SignupScreenProps {
  onSwitchToLogin: () => void;
}

export function SignupScreen({ onSwitchToLogin }: SignupScreenProps) {
  const { login } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      await api.signup(businessName.trim(), email.trim(), password);
      // Registro y login son dos pasos separados en el backend (POST
      // /signup crea la cuenta, no una sesión) — se encadena el login acá
      // mismo con las credenciales recién elegidas para no mandar a la
      // persona a loguearse a mano después de registrarse.
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
          <p>Registrá tu negocio, activá hasta 5 robots y empezá a ver tus datos en minutos.</p>
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
            <h2>Creá tu cuenta</h2>
            <p>Sin costo mientras estamos en pruebas — activás hasta 5 robots para probar el sistema.</p>
          </div>
          <form onSubmit={handleSubmit}>
            <label className="login-field" htmlFor="signupBusiness">
              <span>Nombre del negocio</span>
              <div className="login-input-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V8l9-5 9 5v13" /><path d="M9 21v-6h6v6" /></svg>
                <input id="signupBusiness" type="text" autoComplete="organization" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} disabled={submitting} placeholder="La Esquina del Sabor" />
              </div>
            </label>
            <label className="login-field" htmlFor="signupEmail">
              <span>Correo electrónico</span>
              <div className="login-input-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
                <input id="signupEmail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} placeholder="usuario@empresa.com" />
              </div>
            </label>
            <label className="login-field" htmlFor="signupPassword">
              <span>Contraseña</span>
              <div className="login-input-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                <input id="signupPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting} placeholder="••••••••••" />
                <button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
              <small className="login-field-hint">Mín. 8 caracteres, con mayúscula, minúscula, número y símbolo.</small>
            </label>
            <label className="login-field" htmlFor="signupConfirmPassword">
              <span>Repetir contraseña</span>
              <div className="login-input-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                <input id="signupConfirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={submitting} placeholder="••••••••••" />
              </div>
            </label>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="login-submit" type="submit" disabled={submitting}>
              {submitting ? <><span className="spinner" /> Creando cuenta…</> : <>Crear cuenta <span>→</span></>}
            </button>
          </form>
          <p className="login-help">
            ¿Ya tenés cuenta?{" "}
            <button type="button" className="login-switch" onClick={onSwitchToLogin} disabled={submitting}>Iniciá sesión</button>
          </p>
        </div>
        <footer>© 2026 InnoApp · Todos los derechos reservados</footer>
      </section>
    </main>
  );
}
