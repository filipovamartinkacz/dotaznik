import { NextResponse } from "next/server";
import { validateOutro, escapeHtml, CONSENT_VERSION, type OutroState } from "@/lib/outro-validation";
import { sendDekovaciEmail, sendNewsletterNotification, sendExpertNotification } from "@/lib/email";

export async function POST(request: Request) {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) {
    return NextResponse.json({ error: "GOOGLE_SCRIPT_URL není nastavené" }, { status: 500 });
  }

  const body = await request.json();
  const { headers, values, outro, message } = body as {
    headers: string[];
    values: string[];
    outro?: OutroState;
    message?: string;
  };

  if (!Array.isArray(headers) || !Array.isArray(values)) {
    return NextResponse.json({ error: "Neplatná data dotazníku" }, { status: 400 });
  }

  // Poslední pojistka nezávislá na JS v prohlížeči — stejná pravidla jako
  // na klientu (viz src/lib/outro-validation.ts).
  let finalHeaders = headers;
  let finalValues = values;

  if (outro) {
    const errors = validateOutro(outro);
    if (errors.email || errors.expertText) {
      return NextResponse.json(
        { error: errors.email ?? errors.expertText },
        { status: 400 }
      );
    }

    const hasConsent = outro.newsletterConsent;
    const now = new Date();

    finalHeaders = [
      ...headers,
      "Vzkaz",
      "E-mail",
      "Souhlas s novinkami",
      "Datum souhlasu",
      "Verze textu souhlasu",
      "Je odbornice",
      "Čemu se věnuje",
    ];
    finalValues = [
      ...values,
      escapeHtml((message ?? "").trim()),
      outro.email.trim(),
      hasConsent ? "ano" : "ne",
      hasConsent ? now.toLocaleString("cs-CZ") : "",
      hasConsent ? CONSENT_VERSION : "",
      outro.isExpert ? "ano" : "ne",
      outro.isExpert ? escapeHtml(outro.expertText.trim()) : "",
    ];
  }

  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ headers: finalHeaders, values: finalValues }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("GOOGLE_SCRIPT_URL response", response.status, text);
    return NextResponse.json({ error: "Uložení do tabulky selhalo" }, { status: 502 });
  }

  // Poděkování + PDF — jen když je vyplněný e-mail. Nekritické: odpovědi
  // jsou v Sheetu uložené i kdyby se e-mail nepodařilo odeslat.
  if (outro?.email.trim()) {
    try {
      await sendDekovaciEmail(outro.email.trim());
    } catch (err) {
      console.error("sendDekovaciEmail failed", err);
    }
  }

  // Interní upozornění — nekritické stejně jako výše.
  if (outro?.newsletterConsent) {
    try {
      await sendNewsletterNotification(outro.email.trim());
    } catch (err) {
      console.error("sendNewsletterNotification failed", err);
    }
  }
  if (outro?.isExpert) {
    try {
      await sendExpertNotification(outro.email.trim(), outro.expertText.trim());
    } catch (err) {
      console.error("sendExpertNotification failed", err);
    }
  }

  return NextResponse.json({ ok: true });
}
