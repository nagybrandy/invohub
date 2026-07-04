// lib/api-keys/credentials.ts
// Parse public/secret key credentials from HTTP headers.
export function parseApiKeyCredentials(request: Request): {
  publicKey: string;
  secretKey: string;
} | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    const colon = token.indexOf(":");
    if (colon > 0) {
      return {
        publicKey: token.slice(0, colon),
        secretKey: token.slice(colon + 1),
      };
    }
  }

  const publicKey = request.headers.get("x-invohub-public-key");
  const secretKey = request.headers.get("x-invohub-secret-key");
  if (publicKey && secretKey) {
    return { publicKey: publicKey.trim(), secretKey: secretKey.trim() };
  }

  return null;
}
