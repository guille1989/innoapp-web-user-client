import { useState } from "react";
import { useAuth } from "./auth/AuthContext";
import { LoginScreen } from "./components/auth/LoginScreen";
import { SignupScreen } from "./components/auth/SignupScreen";
import { AuthenticatedApp } from "./AuthenticatedApp";

function App() {
  const { status } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  if (status === "loading") {
    return (
      <div className="app-loading">
        <img src="/brand/innoapp-mark.png" alt="InnoApp" />
        <span className="spinner" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return authMode === "login"
      ? <LoginScreen onSwitchToSignup={() => setAuthMode("signup")} />
      : <SignupScreen onSwitchToLogin={() => setAuthMode("login")} />;
  }

  return <AuthenticatedApp />;
}

export default App;
