import { useAuth } from "./auth/AuthContext";
import { LoginScreen } from "./components/auth/LoginScreen";
import { AuthenticatedApp } from "./AuthenticatedApp";

function App() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="app-loading">
        <img src="/brand/innoapp-mark.png" alt="InnoApp" />
        <span className="spinner" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <LoginScreen />;
  }

  return <AuthenticatedApp />;
}

export default App;
