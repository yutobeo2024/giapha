import type { Env } from "../../_lib/env";

/**
 * Proxy /__/auth/* sang <project>.firebaseapp.com/__/auth/*
 * để app dùng chính domain của mình làm authDomain (xem src/firebase.ts).
 * Tránh lỗi đăng nhập khi trình duyệt chặn cookie bên thứ ba.
 */
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, `https://${env.FIREBASE_AUTH_DOMAIN}`);

  const headers = new Headers(request.headers);
  headers.set("Host", env.FIREBASE_AUTH_DOMAIN);
  headers.delete("cf-connecting-ip");

  const proxied = await fetch(target.toString(), {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });

  // Trả nguyên trạng, kể cả redirect của Firebase.
  const out = new Headers(proxied.headers);
  return new Response(proxied.body, { status: proxied.status, headers: out });
};
