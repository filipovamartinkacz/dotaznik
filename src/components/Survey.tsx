"use client";

import { useEffect, useRef, useState } from "react";
import { INTRO, QUESTIONS, THANKS_HEADING, THANKS_HTML, type Choice, type Question } from "@/lib/survey-data";
import { validateOutro, type OutroState } from "@/lib/outro-validation";

type Screen = "intro" | "question" | "submitting" | "done" | "error";
type SingleQuestion = Extract<Question, { kind: "single" }>;
type ChoiceQuestion = Extract<Question, { kind: "single" | "multiple" }>;

type Step = { kind: "question"; question: Question } | { kind: "outro" };

const STEPS: Step[] = [
  ...QUESTIONS.map((q): Step => ({ kind: "question", question: q })),
  { kind: "outro" },
];

const PRIVACY_URL = "https://lazena.cz/ochrana-osobnich-udaju/";
const NEWSLETTER_CONSENT_TEXT =
  "Chci e-mailem dostávat novinky z JsemBlažená.cz. Souhlas mohu kdykoliv odvolat odhlášením v každém e-mailu.";

// Sdílení dotazníku z děkovací stránky — dobrovolné, žádná osobní data v URL.
const SHARE_TITLE = "Pomoz tvořit JsemBlažená.cz";
const SHARE_TEXT =
  "Vzniká platforma pro ženy, která propojí péči o tělo i duši. Přidej svůj pohled v krátkém dotazníku.";
const SHARE_URL =
  "https://dotaznik.lazena.cz/?utm_source=share&utm_medium=referral&utm_campaign=dotaznik-sdileni";

const OTHER_PREFIX = "Jiná: ";
const AUTO_ADVANCE_DELAY = 350;
// Chipy jsou přehledné jen pro krátké odpovědi. Otázky s delšími popisky
// (např. #15) se zobrazují jako klasický seznam se zaškrtávátky.
const LONG_CHOICE_TEXT_THRESHOLD = 55;

function hasLongChoices(q: ChoiceQuestion): boolean {
  return q.choices.some((c) => c.text.length > LONG_CHOICE_TEXT_THRESHOLD);
}

function hasOpenChoiceSelected(q: ChoiceQuestion, selected: string[]): boolean {
  return selected.some((choice) => q.choices.find((c) => c.text === choice)?.open);
}

function selectionToString(q: Question, selected: string[], openText: string): string {
  if (q.kind === "text") return selected[0] ?? "";
  return selected
    .map((choice) => {
      const isOpen = q.choices.find((c) => c.text === choice)?.open;
      if (isOpen) return openText.trim() ? `${OTHER_PREFIX}${openText.trim()}` : choice;
      return choice;
    })
    .join("; ");
}

export default function Survey() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [openTexts, setOpenTexts] = useState<Record<number, string>>({});
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Závěrečný krok (vzkaz, e-mail, souhlas s newsletterem, kontakt odbornice)
  const [outroMessage, setOutroMessage] = useState("");
  const [outroEmail, setOutroEmail] = useState("");
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [isExpert, setIsExpert] = useState(false);
  const [expertText, setExpertText] = useState("");
  const [outroTouched, setOutroTouched] = useState<{ email?: boolean; expertText?: boolean }>({});
  const [outroSubmitAttempted, setOutroSubmitAttempted] = useState(false);
  const outroEmailRef = useRef<HTMLInputElement>(null);
  const outroExpertTextRef = useRef<HTMLTextAreaElement>(null);

  // Sdílení dotazníku na děkovací stránce
  const [shareCopyState, setShareCopyState] = useState<"idle" | "copied" | "manual">("idle");

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  const currentStep = STEPS[stepIndex];

  function toggleChoice(q: ChoiceQuestion, choiceText: string) {
    setAnswers((prev) => {
      const current = prev[q.id] ?? [];
      if (q.kind === "single") {
        return { ...prev, [q.id]: [choiceText] };
      }
      const already = current.includes(choiceText);
      if (already) {
        return { ...prev, [q.id]: current.filter((c) => c !== choiceText) };
      }
      if (current.length >= q.max) return prev;
      return { ...prev, [q.id]: [...current, choiceText] };
    });
  }

  function setTextAnswer(q: Question, value: string) {
    setAnswers((prev) => ({ ...prev, [q.id]: value ? [value] : [] }));
  }

  // Chybu pole zobrazíme až po opuštění vyplněného/povinného pole, nebo po
  // pokusu o odeslání (viz outroSubmitAttempted) — ne hned při prvním kliknutí.
  function handleOutroBlur(field: "email" | "expertText") {
    setOutroTouched((prev) => ({ ...prev, [field]: true }));
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setShareCopyState("copied");
    } catch {
      setShareCopyState("manual");
    }
  }

  async function handleShareClick() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL });
        return;
      } catch (err) {
        // Sama zrušila nativní dialog sdílení — nic dalšího neděláme.
        if (err instanceof Error && err.name === "AbortError") return;
        // Jakékoli jiné selhání (např. se nepodařilo otevřít share sheet)
        // → spadneme na kopírování odkazu, ať tlačítko nikdy nezůstane bez reakce.
      }
    }
    await copyShareLink();
  }

  function goNext() {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    if (stepIndex + 1 >= STEPS.length) {
      if (currentStep.kind === "outro") {
        setOutroSubmitAttempted(true);
        const errors = validateOutro({ email: outroEmail, newsletterConsent, isExpert, expertText });
        if (errors.email) {
          outroEmailRef.current?.focus();
          return;
        }
        if (errors.expertText) {
          outroExpertTextRef.current?.focus();
          return;
        }
      }
      submit();
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  function goBack() {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    if (stepIndex === 0) {
      setScreen("intro");
    } else {
      setStepIndex((i) => i - 1);
    }
  }

  // Klik na jednovýběrovou odpověď rovnou posune na další otázku – ušetří
  // krok navíc. Pokud je zvolena otevřená odpověď "Jiná", čeká se na doplnění
  // textu a posun je nutné potvrdit tlačítkem Další.
  function handleSingleChoiceClick(q: SingleQuestion, choice: Choice) {
    toggleChoice(q, choice.text);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (!choice.open) {
      advanceTimer.current = setTimeout(goNext, AUTO_ADVANCE_DELAY);
    }
  }

  function isQuestionValid(q: Question): boolean {
    const selected = answers[q.id] ?? [];
    if (q.kind === "text") return true;
    if (hasOpenChoiceSelected(q, selected) && !(openTexts[q.id] ?? "").trim()) return false;
    if (!q.required) return true;
    return selected.length >= q.min && selected.length <= q.max;
  }

  async function submit() {
    setScreen("submitting");
    const headers = ["Časové razítko", ...QUESTIONS.map((q) => q.text)];
    const values = [
      new Date().toLocaleString("cs-CZ"),
      ...QUESTIONS.map((q) => selectionToString(q, answers[q.id] ?? [], openTexts[q.id] ?? "")),
    ];
    // Obsah skrytého pole "čemu se věnuješ" se po odškrtnutí "jsem odbornice"
    // neposílá jako odborná poptávka, i kdyby v něm zůstal starší text.
    const outro: OutroState = {
      email: outroEmail,
      newsletterConsent,
      isExpert,
      expertText: isExpert ? expertText : "",
    };
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers, values, outro, message: outroMessage }),
      });
      if (!res.ok) throw new Error("submit failed");
      setScreen("done");
    } catch {
      setScreen("error");
    }
  }

  if (screen === "intro") {
    return (
      <div className="flex min-h-screen flex-col md:flex-row">
        <img
          src="/intro-foto-mobile.webp"
          alt="Žena s květinami"
          className="w-full aspect-[2.4/1] object-cover md:hidden"
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center md:py-16">
          <h1 className="text-2xl font-semibold text-primary">{INTRO.title}</h1>
          <div
            className="max-w-xl space-y-3 text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: INTRO.content }}
          />
          <button
            onClick={() => setScreen("question")}
            className="mt-4 rounded-full bg-primary px-8 py-3 font-medium text-primary-foreground transition hover:opacity-90"
          >
            {INTRO.startButton}
          </button>
        </div>
        <img
          src="/intro-foto.webp"
          alt="Žena s květinami"
          className="hidden md:sticky md:top-0 md:block md:h-screen md:w-1/2 object-cover object-[center_65%]"
        />
      </div>
    );
  }

  if (screen === "submitting") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Odesílám odpovědi…
      </div>
    );
  }

  if (screen === "error") {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-destructive">Odpovědi se nepodařilo uložit. Zkus to prosím znovu.</p>
        <button
          onClick={submit}
          className="rounded-full bg-primary px-6 py-2 font-medium text-primary-foreground"
        >
          Zkusit znovu
        </button>
      </div>
    );
  }

  if (screen === "done") {
    return (
      <div className="flex min-h-screen flex-col md:flex-row">
        <img
          src="/intro-foto-mobile.webp"
          alt="Žena s květinami"
          className="w-full aspect-[2.4/1] object-cover md:hidden"
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <h2 className="text-lg font-semibold">{THANKS_HEADING}</h2>
          <div className="max-w-xl space-y-3" dangerouslySetInnerHTML={{ __html: THANKS_HTML }} />

          <div className="mt-8 flex max-w-xl flex-col items-center gap-3 border-t border-border pt-8">
            <h3 className="text-lg font-semibold">Znáš ženu, jejíž názor by nám mohl pomoct?</h3>
            <p className="text-sm text-muted-foreground">
              Pošli jí dotazník a pomoz nám tvořit JsemBlažená.cz společně.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <button
                onClick={handleShareClick}
                className="rounded-full bg-primary px-6 py-2 font-medium text-primary-foreground transition hover:opacity-90"
              >
                Sdílet dotazník
              </button>
              <button
                onClick={copyShareLink}
                className="rounded-full bg-secondary px-6 py-2 font-medium text-foreground transition hover:opacity-90"
              >
                Zkopírovat odkaz
              </button>
            </div>
            {shareCopyState === "copied" && (
              <p className="text-sm text-primary">Odkaz je zkopírovaný. Děkujeme za sdílení!</p>
            )}
            {shareCopyState === "manual" && (
              <div className="mt-2 w-full max-w-sm text-left">
                <label htmlFor="share-url" className="mb-1 block text-xs text-muted-foreground">
                  Zkopíruj odkaz ručně:
                </label>
                <input
                  id="share-url"
                  type="text"
                  readOnly
                  value={SHARE_URL}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-lg border border-input bg-card p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </div>

          <p className="mt-6 text-xs text-muted-foreground">Zdroj fotografie: magnific.com</p>
        </div>
        <img
          src="/intro-foto.webp"
          alt="Žena s květinami"
          className="hidden md:sticky md:top-0 md:block md:h-screen md:w-1/2 object-cover object-[center_65%]"
        />
      </div>
    );
  }

  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  // Na závěrečném kroku tlačítko nikdy nezakazujeme — chyby (a blokace
  // odeslání) řeší goNext() při pokusu o odeslání, viz validateOutro.
  const valid = currentStep.kind === "outro" ? true : isQuestionValid(currentStep.question);

  const outroErrors = validateOutro({ email: outroEmail, newsletterConsent, isExpert, expertText });
  const outroEmailRequired = newsletterConsent || isExpert;
  const outroEmailErrorVisible = !!outroErrors.email && (outroSubmitAttempted || outroTouched.email);
  const outroExpertTextErrorVisible =
    !!outroErrors.expertText && (outroSubmitAttempted || outroTouched.expertText);

  function renderChoiceChips(q: ChoiceQuestion) {
    const selected = answers[q.id] ?? [];
    return (
      <div className="mb-2 flex flex-wrap gap-2">
        {q.choices.map((choice) => {
          const isChecked = selected.includes(choice.text);
          const disabled = !isChecked && q.kind === "multiple" && selected.length >= q.max;
          return (
            <button
              key={choice.text}
              type="button"
              disabled={disabled}
              onClick={() => toggleChoice(q, choice.text)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                isChecked
                  ? "border-primary bg-primary text-primary-foreground"
                  : disabled
                    ? "border-border bg-secondary text-muted-foreground opacity-40"
                    : "border-border bg-secondary text-foreground"
              }`}
            >
              {choice.text}
            </button>
          );
        })}
      </div>
    );
  }

  function renderMultiList(q: Extract<Question, { kind: "multiple" }>) {
    const selected = answers[q.id] ?? [];
    return (
      <div className="flex flex-col gap-3">
        {q.choices.map((choice) => {
          const isChecked = selected.includes(choice.text);
          const disabled = !isChecked && selected.length >= q.max;
          return (
            <div key={choice.text}>
              <label
                className={`flex items-center gap-3 rounded-lg border p-3 transition ${
                  isChecked ? "border-primary bg-secondary" : disabled ? "border-border opacity-40" : "border-border"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={disabled}
                  onChange={() => toggleChoice(q, choice.text)}
                  className="accent-[var(--primary)]"
                />
                <span>{choice.text}</span>
              </label>
              {choice.open && isChecked && (
                <input
                  type="text"
                  value={openTexts[q.id] ?? ""}
                  onChange={(e) => setOpenTexts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Upřesni…"
                  className="mt-2 w-full rounded-lg border border-input bg-card p-2 outline-none focus:ring-2 focus:ring-ring"
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderSingleList(q: SingleQuestion) {
    const selected = answers[q.id] ?? [];
    return (
      <div className="flex flex-col gap-3">
        {q.choices.map((choice) => {
          const isChecked = selected.includes(choice.text);
          return (
            <div key={choice.text}>
              <label
                className={`flex items-center gap-3 rounded-lg border p-3 transition ${
                  isChecked ? "border-primary bg-secondary" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name={`q-${q.id}`}
                  checked={isChecked}
                  onChange={() => handleSingleChoiceClick(q, choice)}
                  className="accent-[var(--primary)]"
                />
                <span>{choice.text}</span>
              </label>
              {choice.open && isChecked && (
                <input
                  type="text"
                  value={openTexts[q.id] ?? ""}
                  onChange={(e) => setOpenTexts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Upřesni…"
                  className="mt-2 w-full rounded-lg border border-input bg-card p-2 outline-none focus:ring-2 focus:ring-ring"
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <img
        src="/intro-foto-mobile.webp"
        alt="Žena s květinami"
        className="w-full aspect-[2.4/1] object-cover md:hidden"
      />
      <div className="flex w-full flex-1 flex-col px-6 py-10 md:px-12">
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
          <div className="mb-8 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          {currentStep.kind !== "outro" && (
            <p className="mb-2 text-sm text-muted-foreground">
              Otázka {currentStep.question.number} z {QUESTIONS.length}
            </p>
          )}

          {currentStep.kind === "outro" ? (
            <div className="mb-8 flex flex-col gap-6">
              <div>
                <h2 className="mb-1 text-lg font-semibold">Chceš nám na závěr něco vzkázat?</h2>
                <p className="text-sm text-muted-foreground">Celá tato část je dobrovolná.</p>
              </div>

              <div>
                <label htmlFor="outro-message" className="mb-1 block text-sm font-medium">
                  Tvůj vzkaz (nepovinné)
                </label>
                <textarea
                  id="outro-message"
                  value={outroMessage}
                  onChange={(e) => setOutroMessage(e.target.value)}
                  placeholder="Co bys nám chtěla říct?"
                  rows={4}
                  className="w-full rounded-lg border border-input bg-card p-3 outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label htmlFor="outro-email" className="mb-1 block text-sm font-medium">
                  E-mail ({outroEmailRequired ? "povinné" : "nepovinné"})
                </label>
                <input
                  ref={outroEmailRef}
                  id="outro-email"
                  type="email"
                  autoComplete="email"
                  placeholder="tvuj@email.cz"
                  value={outroEmail}
                  onChange={(e) => setOutroEmail(e.target.value)}
                  onBlur={() => handleOutroBlur("email")}
                  aria-invalid={outroEmailErrorVisible}
                  aria-describedby="outro-email-hint"
                  className={`w-full rounded-lg border bg-card p-3 outline-none focus:ring-2 focus:ring-ring ${
                    outroEmailErrorVisible ? "border-destructive" : "border-input"
                  }`}
                />
                <p id="outro-email-hint" className="mt-1 text-xs text-muted-foreground">
                  Nech nám svůj e-mail a jako poděkování ti pošleme PDF „50 cest k sobě, které možná ještě
                  neznáš“.
                </p>
                {outroEmailErrorVisible && (
                  <p className="mt-1 text-xs text-destructive">{outroErrors.email}</p>
                )}
              </div>

              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={newsletterConsent}
                  onChange={(e) => setNewsletterConsent(e.target.checked)}
                  className="mt-0.5 accent-[var(--primary)]"
                />
                <span>
                  {NEWSLETTER_CONSENT_TEXT}{" "}
                  <a
                    href={PRIVACY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Informace o zpracování osobních údajů
                  </a>
                </span>
              </label>

              <div>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={isExpert}
                    onChange={(e) => setIsExpert(e.target.checked)}
                    className="mt-0.5 accent-[var(--primary)]"
                  />
                  <span>Jsem odbornice a platforma JsemBlažená.cz mě zaujala.</span>
                </label>

                <div
                  className={`grid transition-all duration-300 ease-out ${
                    isExpert ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="mt-3 pl-7">
                      <label htmlFor="outro-expert-text" className="mb-1 block text-sm font-medium">
                        Čemu se věnuješ?
                      </label>
                      <textarea
                        ref={outroExpertTextRef}
                        id="outro-expert-text"
                        value={expertText}
                        onChange={(e) => setExpertText(e.target.value)}
                        onBlur={() => handleOutroBlur("expertText")}
                        placeholder="Napiš nám stručně, co děláš a jak si představuješ možné propojení."
                        rows={3}
                        aria-invalid={outroExpertTextErrorVisible}
                        className={`w-full rounded-lg border bg-card p-3 outline-none focus:ring-2 focus:ring-ring ${
                          outroExpertTextErrorVisible ? "border-destructive" : "border-input"
                        }`}
                      />
                      {outroExpertTextErrorVisible && (
                        <p className="mt-1 text-xs text-destructive">{outroErrors.expertText}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                E-mail použijeme k zaslání PDF, případné reakci na tvůj vzkaz nebo k domluvě možné
                spolupráce. Novinky budeme posílat pouze tehdy, pokud výše udělíš samostatný souhlas. Více v{" "}
                <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline">
                  Informacích o zpracování osobních údajů
                </a>
                .
              </p>
            </div>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-semibold">{currentStep.question.text}</h2>
              {currentStep.question.helpText && (
                <p className="mb-6 text-sm text-muted-foreground">{currentStep.question.helpText}</p>
              )}

              <div className="mb-8">
                {currentStep.question.kind === "text" ? (
                  <textarea
                    value={(answers[currentStep.question.id] ?? [])[0] ?? ""}
                    onChange={(e) => setTextAnswer(currentStep.question, e.target.value)}
                    maxLength={currentStep.question.maxLength ?? undefined}
                    rows={4}
                    className="w-full rounded-lg border border-input bg-card p-3 outline-none focus:ring-2 focus:ring-ring"
                  />
                ) : currentStep.question.kind === "single" ? (
                  renderSingleList(currentStep.question)
                ) : hasLongChoices(currentStep.question) ? (
                  renderMultiList(currentStep.question)
                ) : (
                  <>
                    {renderChoiceChips(currentStep.question)}
                    {hasOpenChoiceSelected(
                      currentStep.question,
                      answers[currentStep.question.id] ?? []
                    ) && (
                      <input
                        type="text"
                        value={openTexts[currentStep.question.id] ?? ""}
                        onChange={(e) => {
                          const id = currentStep.question.id;
                          setOpenTexts((prev) => ({ ...prev, [id]: e.target.value }));
                        }}
                        placeholder="Upřesni…"
                        className="mt-2 w-full rounded-lg border border-input bg-card p-2 outline-none focus:ring-2 focus:ring-ring"
                      />
                    )}
                  </>
                )}
              </div>
            </>
          )}

          <div className="mt-auto flex justify-between">
            <button
              onClick={goBack}
              className="rounded-full border border-border px-6 py-2 font-medium text-foreground"
            >
              Zpět
            </button>
            <button
              onClick={goNext}
              disabled={!valid}
              className="rounded-full bg-primary px-6 py-2 font-medium text-primary-foreground disabled:opacity-40"
            >
              {stepIndex + 1 >= STEPS.length ? "Odeslat dotazník" : "Další"}
            </button>
          </div>
        </div>
      </div>
      <img
        src="/intro-foto.webp"
        alt="Žena s květinami"
        className="hidden md:sticky md:top-0 md:block md:h-screen md:w-1/2 object-cover object-[center_65%]"
      />
    </div>
  );
}
