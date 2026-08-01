import { useAuth } from "./auth/AuthContext";
import { LoginScreen } from "./components/auth/LoginScreen";
import { AuthenticatedApp } from "./AuthenticatedApp";

function App() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="login-screen">
        <div className="page-sub">Cargando...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <LoginScreen />;
  }

  return <AuthenticatedApp />;
}

export default App;
