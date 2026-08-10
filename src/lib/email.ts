import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = "JsemBlažená.cz <dotaznik@jsemblazena.lazena.cz>";
// Náhodný, neuhodnutelný název souboru + noindex hlavička (next.config.ts)
// a robots.txt disallow — soubor se nemá dát najít vyhledávači, jen přes
// tenhle odkaz v e-mailu.
const PDF_URL = "https://dotaznik.lazena.cz/soubory/JsemBlazena.cz-50-cest-k-sobe-868e1be595.pdf";

// Poděkování + slíbený dárek (PDF) po vyplnění dotazníku. Posílá se jen
// když žena vyplnila e-mail — bez RESEND_API_KEY se tiše přeskočí (stejný
// vzor jako v Katalogu, ať appka nespadne, když env proměnná chybí).
export async function sendDekovaciEmail(to: string) {
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to,
    subject: "🎁 Děkuji za vyplnění dotazníku — tady je tvůj dárek",
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
        <p style="margin: 0 0 16px 0;">Ahoj,</p>
        <p style="margin: 0 0 16px 0;">moc děkuji, že sis našla čas na <a href="https://dotaznik.lazena.cz" style="color: #B8474F; text-decoration: underline;">vyplnění dotazníku</a> pro <strong>JsemBlažená.cz</strong>.</p>
        <p style="margin: 0 0 16px 0;">Jako poděkování ti posílám slíbený dárek — e-book <strong>„50 cest k sobě, které možná ještě neznáš“</strong>.</p>
        <p style="margin: 0 0 24px 0;">
          <a href="${PDF_URL}" style="display: inline-block; background: #B8474F; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Stáhnout PDF
          </a>
        </p>
        <p style="margin: 0 0 16px 0;">Tvé odpovědi mi pomohou vytvořit prostor, který bude sloužit nejen tobě, ale i dalším ženám hledajícím lepší orientaci v péči o tělo i duši.</p>
        <p style="margin: 32px 0 0 0;">Ať se ti daří,<br><a href="https://lazena.cz/kdo-jsem/" style="color: #B8474F; text-decoration: underline;">Nikola Hodovská</a></p>
      </div>
    `,
  });
}
