import { useEffect, useState } from "react";
import { RequestScope } from "../lib/requestScope";

export function useRequestScope(_idToken: string) {
  // App remonta por tenant/usuario; renovar su JWT conserva las mutaciones en vuelo.
  const [scope] = useState(() => new RequestScope());
  useEffect(() => {
    scope.activate();
    return () => scope.dispose();
  }, [scope]);
  return scope;
}
