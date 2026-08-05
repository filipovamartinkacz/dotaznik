"use client";

import { useEffect, useRef, useState } from "react";
import { INTRO, QUESTIONS, THANKS_HTML, type Choice, type Question } from "@/lib/survey-data";

type Screen = "intro" | "question" | "submitting" | "done" | "error";
type SingleQuestion = Extract<Question, { kind: "single" }>;
type ChoiceQuestion = Extract<Question, { kind: "single" | "multiple" }>;

// Testovací obrazovka: otázky 8–10 sloučené na jednu obrazovku pro srovnání s
// jejich standardním zobrazením po jedné. Zařazena hned za otázku 10 v toku.
const COMBO_AFTER_NUMBER = 10;
const COMBO_QUESTION_NUMBERS = [8, 9, 10];
const comboQuestions = COMBO_QUESTION_NUMBERS.map(
  (n) => QUESTIONS.find((q) => q.number === n) as SingleQuestion
);

type Step = { kind: "question"; question: Question } | { kind: "combo" };

const STEPS: Step[] = [];
for (const q of QUESTIONS) {
  STEPS.push({ kind: "question", question: q });
  if (q.number === COMBO_AFTER_NUMBER) STEPS.push({ kind: "combo" });
}

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

  function goNext() {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    if (stepIndex + 1 >= STEPS.length) {
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
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers, values }),
      });
      if (!res.ok) throw new Error("submit failed");
      setScreen("done");
    } catch {
      setScreen("error");
    }
  }

  if (screen === "intro") {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-primary">{INTRO.title}</h1>
        <div
          className="space-y-3 text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: INTRO.content }}
        />
        <button
          onClick={() => setScreen("question")}
          className="mt-4 rounded-full bg-primary px-8 py-3 font-medium text-primary-foreground transition hover:opacity-90"
        >
          {INTRO.startButton}
        </button>
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
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="space-y-3" dangerouslySetInnerHTML={{ __html: THANKS_HTML }} />
      </div>
    );
  }

  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const valid =
    currentStep.kind === "combo"
      ? comboQuestions.every((q) => isQuestionValid(q))
      : isQuestionValid(currentStep.question);

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
                    ? "border-border text-muted-foreground opacity-40"
                    : "border-border bg-card text-foreground"
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
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-10">
      <div className="mb-8 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {currentStep.kind === "combo" ? (
        <>
          <p className="mb-2 text-sm text-muted-foreground">Srovnání – testovací zobrazení</p>
          <h2 className="mb-6 text-lg font-semibold">Otázky 8–10 na jedné obrazovce</h2>
          <div className="mb-8 flex flex-col gap-6">
            {comboQuestions.map((q) => (
              <div key={q.id}>
                <p className="mb-2 text-sm font-medium">{q.text}</p>
                {renderChoiceChips(q)}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground">
            Otázka {currentStep.question.number} z {QUESTIONS.length}
          </p>
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
          {stepIndex + 1 >= STEPS.length ? "Odeslat" : "Další"}
        </button>
      </div>
    </div>
  );
}
