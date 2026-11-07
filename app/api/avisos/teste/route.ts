// Manda uma notificação de teste para os aparelhos de quem está logado.
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!token) return Response.json({ erro: "Entre no app." }, { status: 401 });
  if (!pub || !priv)
    return Response.json(
      { erro: "Faltam as chaves VAPID na Vercel." },
      { status: 501 },
    );
  const sb = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: u } = await sb.auth.getUser(token);
  if (!u.user?.email)
    return Response.json({ erro: "Entre no app." }, { status: 401 });
  const { data: subs, error } = await sb
    .from("push_inscricoes")
    .select("*")
    .eq("email", u.user.email.toLowerCase());
  if (error) return Response.json({ erro: error.message }, { status: 500 });
  webpush.setVapidDetails("mailto:chachafinance@example.com", pub, priv);
  let enviados = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({
          titulo: "Avisos ligados",
          corpo: "É assim que os lembretes do chachafinance vão chegar.",
          url: "/",
        }),
      );
      enviados++;
    } catch {}
  }
  return Response.json({ enviados });
}
