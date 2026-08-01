import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { describeAuthError } from "../../auth/cognito";

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="login-screen">
      <div className="login-card">
        <div className="brand" style={{ marginBottom: 24 }}>
          <div className="brand-dot">DP</div>
          <div className="brand-name">DataPulse Ops</div>
        </div>

        <div className="page-title">Iniciá sesión</div>
        <div className="page-sub">Entrá con el email y contraseña de tu negocio.</div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="loginEmail">
              Email
            </label>
            <input
              id="loginEmail"
              type="email"
              className="text-input"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="loginPassword">
              Contraseña
            </label>
            <input
              id="loginPassword"
              type="password"
              className="text-input"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
