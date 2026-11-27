"use client";

/**
 * Cliente do Supabase no navegador. Usa SOMENTE a chave publicável: quem protege
 * os dados são os grants, o RLS e as funções no banco.
 */
import { createClient, isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";
import { GameError, toGameError } from "../room/errors";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Recusa chaves administrativas caso alguém as coloque por engano. */
function isSecretKey(key: string) {
  if (key.startsWith("sb_secret_")) return true;
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).role === "service_role";
  } catch {
    return false;
  }
}

export const isConfigured = Boolean(URL_ && KEY) && !isSecretKey(KEY);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isConfigured) throw new GameError("not_configured");
  client ??= createClient(URL_, KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "dominacao-chocolatosa:sessao",
    },
  });
  return client;
}

/** Usuário da sessão guardada, sem criar nenhum. */
export async function storedUserId(): Promise<string | null> {
  const { data, error } = await getSupabase().auth.getSession();
  // Falha ao renovar por rede não é "sem sessão": criar outro usuário aqui
  // duplicaria a pessoa na sala.
  if (error && isAuthRetryableFetchError(error)) throw new GameError("network");
  return data.session?.user.id ?? null;
}

let signingIn: Promise<string> | null = null;

/** Reaproveita a sessão anônima; só cria uma quando a pessoa age e não há nenhuma. */
export function ensureSession(): Promise<string> {
  signingIn ??= withLock(async () => {
    const existing = await storedUserId();
    if (existing) return existing;
    const { data, error } = await getSupabase().auth.signInAnonymously();
    if (error || !data.user) throw toGameError(error);
    return data.user.id;
  }).finally(() => {
    signingIn = null;
  });
  return signingIn;
}

/** Impede que duas abas criem duas identidades ao mesmo tempo. */
function withLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  return locks ? (locks.request("dominacao-chocolatosa:entrar", task) as Promise<T>) : task();
}
