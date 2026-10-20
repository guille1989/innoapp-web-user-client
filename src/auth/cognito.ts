import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  NotAuthorizedException,
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider";
import type { Session } from "./session";
export { userFromIdToken } from "./session";
export type { Session, SessionUser } from "./session";

const REGION = import.meta.env.VITE_COGNITO_REGION;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;

const client = new CognitoIdentityProviderClient({ region: REGION });

export async function login(email: string, password: string): Promise<Session> {
  const result = await client.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }),
  );

  const auth = result.AuthenticationResult;
  if (!auth?.IdToken || !auth.AccessToken || !auth.RefreshToken || !auth.ExpiresIn) {
    throw new Error("Cognito no devolvió una sesión completa");
  }
  return {
    idToken: auth.IdToken,
    accessToken: auth.AccessToken,
    refreshToken: auth.RefreshToken,
    expiresAt: Date.now() + auth.ExpiresIn * 1000,
  };
}

export async function refreshSession(refreshToken: string): Promise<Session> {
  const result = await client.send(
    new InitiateAuthCommand({
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    }),
  );

  const auth = result.AuthenticationResult;
  if (!auth?.IdToken || !auth.AccessToken || !auth.ExpiresIn) {
    throw new Error("Cognito no devolvió una sesión completa al refrescar");
  }
  return {
    idToken: auth.IdToken,
    accessToken: auth.AccessToken,
    // REFRESH_TOKEN_AUTH no reemite un refresh token nuevo — Cognito
    // conserva el mismo hasta que expire (30 días por default).
    refreshToken,
    expiresAt: Date.now() + auth.ExpiresIn * 1000,
  };
}

export function describeAuthError(err: unknown): string {
  if (err instanceof NotAuthorizedException || err instanceof UserNotFoundException) {
    // Mismo mensaje para "no existe" y "contraseña incorrecta" — no hay
    // motivo para que alguien probando emails al azar pueda distinguirlos.
    return "Email o contraseña incorrectos.";
  }
  if (err instanceof Error) return err.message;
  return "No se pudo iniciar sesión.";
}
