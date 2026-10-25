"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import type { Question } from "@/lib/tutor/types";

export type QuestionPatch = Partial<{
  questionText: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  expectedAnswer: string;
  acceptedAnswers: string[];
  rubric: { criteria: { criterion: string; points: number }[] };
  teacherNote: string | null;
}>;

/** Inline editor; saving marks the question "teacher edited" on the server. */
export function QuestionEditor({
  question,
  onSave,
  onCancel,
}: {
  question: Question;
  onSave: (patch: QuestionPatch) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(question.questionText);
  const [options, setOptions] = useState(question.options ?? []);
  const [correct, setCorrect] = useState(question.correctOptionId ?? "");
  const [accepted, setAccepted] = useState(question.acceptedAnswers.join(", "));
  const [expected, setExpected] = useState(question.expectedAnswer);
  const [criteria, setCriteria] = useState(question.rubric.criteria.map((c) => ({ criterion: c.criterion, points: c.points })));
  const [note, setNote] = useState(question.teacherNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const letters = ["A", "B", "C", "D"];

  async function save() {
    setError(null);
    const patch: QuestionPatch = { questionText: text.trim(), teacherNote: note.trim() || null };
    if (question.type === "mcq") {
      const opts = options.map((o, i) => ({ id: letters[i], text: o.text.trim() }));
      if (opts.some((o) => !o.text)) return setError("Fill in every option, or remove the empty one.");
      const idx = options.findIndex((o) => o.id === correct);
      if (idx < 0) return setError("Choose which option is correct.");
      patch.options = opts;
      patch.correctOptionId = letters[idx];
    } else if (question.type === "fill_blank") {
      const list = accepted.split(",").map((a) => a.trim()).filter(Boolean);
      if (!list.length) return setError("Add at least one accepted answer.");
      if (!/_{2,}/.test(text)) return setError("Keep a blank in the question, written as ___.");
      patch.acceptedAnswers = list;
    } else {
      if (!expected.trim()) return setError("Write the expected answer.");
      const list = criteria.filter((c) => c.criterion.trim());
      if (!list.length) return setError("Keep at least one rubric criterion.");
      patch.expectedAnswer = expected.trim();
      patch.rubric = { criteria: list.map((c) => ({ criterion: c.criterion.trim(), points: c.points })) };
    }
    if (patch.questionText!.length < 3) return setError("The question is too short.");
    setSaving(true);
    try {
      await onSave(patch);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-accent-line bg-accent-soft/40 p-4">
      <Field label="Question" htmlFor={`e-text-${question.id}`}>
        <Textarea id={`e-text-${question.id}`} value={text} onChange={(e) => setText(e.target.value)} className="min-h-16" />
      </Field>

      {question.type === "mcq" && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Options — select the correct one</legend>
          {options.map((o, i) => (
            <div key={o.id} className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="radio"
                  name={`correct-${question.id}`}
                  checked={correct === o.id}
                  onChange={() => setCorrect(o.id)}
                  className="size-4 accent-[var(--color-accent)]"
                  aria-label={`Option ${letters[i]} is correct`}
                />
                {letters[i]}
              </label>
              <Input value={o.text} onChange={(e) => setOptions(options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))} aria-label={`Option ${letters[i]} text`} />
              {options.length > 2 && (
                <Button variant="ghost" size="sm" onClick={() => setOptions(options.filter((x) => x.id !== o.id))} aria-label={`Remove option ${letters[i]}`}>
                  <Trash className="size-4" />
                </Button>
              )}
            </div>
          ))}
          {options.length < 4 && (
            <Button variant="quiet" size="sm" onClick={() => setOptions([...options, { id: `new${Date.now()}`, text: "" }])} icon={<Plus className="size-4" />}>
              Add option
            </Button>
          )}
        </fieldset>
      )}

      {question.type === "fill_blank" && (
        <Field label="Accepted answers" htmlFor={`e-acc-${question.id}`} hint="Separate variants with commas. Matching ignores case and punctuation.">
          <Input id={`e-acc-${question.id}`} value={accepted} onChange={(e) => setAccepted(e.target.value)} />
        </Field>
      )}

      {(question.type === "short_answer" || question.type === "comprehension") && (
        <>
          <Field label="Expected answer" htmlFor={`e-exp-${question.id}`}>
            <Textarea id={`e-exp-${question.id}`} value={expected} onChange={(e) => setExpected(e.target.value)} className="min-h-16" />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Rubric</legend>
            {criteria.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={c.criterion} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, criterion: e.target.value } : x)))} aria-label={`Criterion ${i + 1}`} />
                <Select value={c.points} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, points: Number(e.target.value) } : x)))} className="w-24" aria-label={`Points for criterion ${i + 1}`}>
                  {[1, 2, 3, 4, 5].map((p) => (
                    <option key={p} value={p}>
                      {p} pt
                    </option>
                  ))}
                </Select>
                {criteria.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => setCriteria(criteria.filter((_, j) => j !== i))} aria-label={`Remove criterion ${i + 1}`}>
                    <Trash className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            {criteria.length < 5 && (
              <Button variant="quiet" size="sm" onClick={() => setCriteria([...criteria, { criterion: "", points: 1 }])} icon={<Plus className="size-4" />}>
                Add criterion
              </Button>
            )}
            <p className="text-xs text-ink-2 tabular">Maximum score: {criteria.reduce((s, c) => s + c.points, 0)}</p>
          </fieldset>
        </>
      )}

      <Field label="Teacher note (optional)" htmlFor={`e-note-${question.id}`}>
        <Input id={`e-note-${question.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} />
      </Field>

      {error && <Notice tone="bad">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} loading={saving}>
          Save changes
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <p className="self-center text-xs text-ink-2">Saved edits are marked “Teacher edited”, not “Verified”.</p>
      </div>
    </div>
  );
}
