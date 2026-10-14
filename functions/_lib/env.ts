/** Bindings và biến môi trường của Pages Functions (khai báo trong wrangler.toml / Dashboard). */
export interface Env {
  PHOTOS: R2Bucket;
  FIREBASE_PROJECT_ID: string;
  FIRESTORE_DATABASE_ID: string;
  FIREBASE_AUTH_DOMAIN: string;
  SUPER_ADMIN_EMAIL: string;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export function error(message: string, status: number): Response {
  return json({ error: message }, status);
}
