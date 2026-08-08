// Sdílená validace závěrečného kroku dotazníku — používá ji jak klient
// (Survey.tsx, pro živé chyby ve formuláři), tak server (/api/submit,
// jako poslední pojistka nezávislá na JS v prohlížeči).

export type OutroState = {
  email: string;
  newsletterConsent: boolean;
  isExpert: boolean;
  expertText: string;
};

export type OutroErrors = {
  email?: string;
  expertText?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateOutro(state: OutroState): OutroErrors {
  const errors: OutroErrors = {};
  const email = state.email.trim();

  if (!email) {
    if (state.isExpert) {
      errors.email = "Abychom se ti mohly ozvat, doplň prosím e-mail.";
    } else if (state.newsletterConsent) {
      errors.email = "Pro zasílání novinek doplň prosím e-mail.";
    }
  } else if (!EMAIL_RE.test(email)) {
    errors.email = "Zadej prosím platnou e-mailovou adresu.";
  }

  if (state.isExpert && !state.expertText.trim()) {
    errors.expertText = "Napiš nám prosím stručně, čemu se věnuješ.";
  }

  return errors;
}

// Verze textu souhlasu s newsletterem — pro dohledatelnost, kdyby se
// znění v budoucnu změnilo. Při každé změně OUTRO_NEWSLETTER_LABEL
// (viz Survey.tsx) je potřeba tuto verzi ručně povýšit.
export const CONSENT_VERSION = "2026-08-08";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
