import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) {
    return NextResponse.json({ error: "GOOGLE_SCRIPT_URL není nastavené" }, { status: 500 });
  }

  const body = await request.json();

  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("GOOGLE_SCRIPT_URL response", response.status, text);
    return NextResponse.json({ error: "Uložení do tabulky selhalo" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
