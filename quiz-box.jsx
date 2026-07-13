import { useState, useEffect, useRef } from "react";
import { Plus, Pencil, Trash2, Check, X, RotateCcw, ChevronRight, ListChecks, Play, CheckSquare, Circle } from "lucide-react";

const INK = "#233150";
const INK_SOFT = "#4b567a";
const CARD = "#F0E7CC";
const CARD_ALT = "#E7DBB4";
const RULE = "#A6392C";
const GOOD = "#3F6B45";
const BAD = "#A6392C";
const PAPER_EDGE = "#D8C99A";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

function letterFor(i) {
  return String.fromCharCode(65 + i);
}

const STARTER = [
  {
    id: "s1",
    question: "日本の首都はどこ?",
    type: "single",
    options: ["大阪", "東京", "京都", "名古屋"],
    correct: [1],
  },
  {
    id: "s2",
    question: "次のうち、哺乳類はどれ?(当てはまるものをすべて選んでください)",
    type: "multiple",
    options: ["イルカ", "サメ", "コウモリ", "トカゲ"],
    correct: [0, 2],
  },
  {
    id: "s3",
    question: "1年は何日?(うるう年を除く)",
    type: "single",
    options: ["364日", "365日", "366日", "360日"],
    correct: [1],
  },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyForm() {
  return { question: "", type: "single", options: ["", "", "", ""], correct: [0] };
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const as = [...a].sort().join(",");
  const bs = [...b].sort().join(",");
  return as === bs;
}

export default function QuizBoxApp() {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [mode, setMode] = useState("edit"); // edit | play
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");

  const [order, setOrder] = useState([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null); // single: number, multiple: array
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const hydrated = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("quiz-box:questions");
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          // migrate legacy single-number "correct" field to array form
          const migrated = parsed.map((q) => ({
            ...q,
            type: q.type || "single",
            correct: Array.isArray(q.correct) ? q.correct : [q.correct],
          }));
          setQuestions(migrated);
        } else {
          setQuestions(STARTER);
        }
      } catch (e) {
        setQuestions(STARTER);
      } finally {
        setLoading(false);
        hydrated.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    (async () => {
      try {
        await window.storage.set("quiz-box:questions", JSON.stringify(questions));
      } catch (e) {
        // ignore save errors silently, data still in memory
      }
    })();
  }, [questions]);

  function startEdit(q) {
    setEditingId(q.id);
    setForm({ question: q.question, type: q.type, options: [...q.options], correct: [...q.correct] });
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError("");
  }

  function deleteQuestion(id) {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
    if (editingId === id) cancelEdit();
  }

  function setType(type) {
    setForm((f) => ({ ...f, type, correct: type === "single" ? [f.correct[0] ?? 0] : f.correct }));
  }

  function toggleCorrect(i) {
    setForm((f) => {
      if (f.type === "single") return { ...f, correct: [i] };
      const has = f.correct.includes(i);
      const next = has ? f.correct.filter((c) => c !== i) : [...f.correct, i];
      return { ...f, correct: next };
    });
  }

  function addOption() {
    setForm((f) => {
      if (f.options.length >= MAX_OPTIONS) return f;
      return { ...f, options: [...f.options, ""] };
    });
  }

  function removeOption(i) {
    setForm((f) => {
      if (f.options.length <= MIN_OPTIONS) return f;
      const options = f.options.filter((_, idx) => idx !== i);
      let correct = f.correct.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c));
      if (f.type === "single" && correct.length === 0) correct = [0];
      return { ...f, options, correct };
    });
  }

  function submitForm(e) {
    e.preventDefault();
    const q = form.question.trim();
    const opts = form.options.map((o) => o.trim());
    if (!q) return setFormError("問題文を入力してください");
    if (opts.some((o) => !o)) return setFormError("すべての選択肢を入力してください");
    if (form.correct.length === 0) return setFormError("正解を少なくとも1つ選んでください");

    if (editingId) {
      setQuestions((qs) =>
        qs.map((item) =>
          item.id === editingId
            ? { ...item, question: q, type: form.type, options: opts, correct: form.correct }
            : item
        )
      );
    } else {
      setQuestions((qs) => [...qs, { id: uid(), question: q, type: form.type, options: opts, correct: form.correct }]);
    }
    cancelEdit();
  }

  function shuffledIndices(n) {
    const arr = Array.from({ length: n }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function startPlay() {
    setOrder(shuffledIndices(questions.length));
    setIdx(0);
    setSelected(null);
    setAnswered(false);
    setScore(0);
    setFinished(false);
    setMode("play");
  }

  function pickSingle(i) {
    if (answered) return;
    const q = questions[order[idx]];
    setSelected(i);
    setAnswered(true);
    if (sameSet([i], q.correct)) setScore((s) => s + 1);
  }

  function toggleMulti(i) {
    if (answered) return;
    setSelected((prev) => {
      const cur = Array.isArray(prev) ? prev : [];
      return cur.includes(i) ? cur.filter((c) => c !== i) : [...cur, i];
    });
  }

  function submitMulti() {
    if (answered) return;
    const q = questions[order[idx]];
    const picked = Array.isArray(selected) ? selected : [];
    setAnswered(true);
    if (picked.length > 0 && sameSet(picked, q.correct)) setScore((s) => s + 1);
  }

  function nextCard() {
    if (idx + 1 >= order.length) {
      setFinished(true);
    } else {
      setIdx((i) => i + 1);
      setSelected(null);
      setAnswered(false);
    }
  }

  const currentQ = mode === "play" && order.length ? questions[order[idx]] : null;

  return (
    <div
      className="min-h-screen w-full flex justify-center px-4 py-8"
      style={{
        backgroundColor: "#DCD2AE",
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(0,0,0,0.035) 0px, rgba(0,0,0,0.035) 1px, transparent 1px, transparent 26px)",
        fontFamily: "'Special Elite', 'Courier New', monospace",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Special+Elite&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        .body-font { font-family: 'Inter', sans-serif; }
        .mono-font { font-family: 'JetBrains Mono', monospace; }
        .tab-btn { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .tab-btn:hover { transform: translateY(-2px); }
        .opt-btn { transition: transform 0.12s ease, box-shadow 0.12s ease, background-color 0.12s ease; }
        .opt-btn:not(:disabled):hover { transform: translateX(3px); }
        .seg-btn { transition: background-color 0.12s ease, color 0.12s ease; }
        .opt-btn:focus-visible, .tab-btn:focus-visible, .seg-btn:focus-visible, button:focus-visible, input:focus-visible {
          outline: 3px solid #233150; outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .tab-btn, .opt-btn { transition: none !important; }
        }
      `}</style>

      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1
            className="text-4xl sm:text-5xl tracking-wide"
            style={{ color: INK, textShadow: "1px 1px 0 rgba(0,0,0,0.08)" }}
          >
            QUIZ BOX
          </h1>
          <div className="mt-2 mx-auto" style={{ width: 120, height: 3, backgroundColor: RULE }} />
          <p className="mt-3 body-font text-sm" style={{ color: INK_SOFT }}>
            自分だけのクイズカードを作って、遊ぼう
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-[-1px] px-2 relative z-10">
          <button
            onClick={() => setMode("edit")}
            className="tab-btn body-font font-semibold text-sm px-5 py-2.5 rounded-t-lg flex items-center gap-2"
            style={{
              backgroundColor: mode === "edit" ? CARD : CARD_ALT,
              color: INK,
              boxShadow: mode === "edit" ? "0 -2px 6px rgba(0,0,0,0.08)" : "none",
              border: `1px solid ${PAPER_EDGE}`,
              borderBottom: mode === "edit" ? "1px solid " + CARD : `1px solid ${PAPER_EDGE}`,
            }}
          >
            <ListChecks size={16} /> 編集
          </button>
          <button
            onClick={() => (questions.length ? startPlay() : setMode("play"))}
            className="tab-btn body-font font-semibold text-sm px-5 py-2.5 rounded-t-lg flex items-center gap-2"
            style={{
              backgroundColor: mode === "play" ? CARD : CARD_ALT,
              color: INK,
              boxShadow: mode === "play" ? "0 -2px 6px rgba(0,0,0,0.08)" : "none",
              border: `1px solid ${PAPER_EDGE}`,
              borderBottom: mode === "play" ? "1px solid " + CARD : `1px solid ${PAPER_EDGE}`,
            }}
          >
            <Play size={16} /> プレイ
          </button>
        </div>

        {/* Content card */}
        <div
          className="rounded-b-lg rounded-tr-lg p-5 sm:p-7 relative"
          style={{ backgroundColor: CARD, border: `1px solid ${PAPER_EDGE}`, boxShadow: "0 4px 14px rgba(0,0,0,0.12)" }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: RULE, opacity: 0.85 }} />

          {loading && (
            <p className="body-font text-center py-10" style={{ color: INK_SOFT }}>
              読み込み中…
            </p>
          )}

          {!loading && mode === "edit" && (
            <EditView
              questions={questions}
              form={form}
              setForm={setForm}
              setType={setType}
              toggleCorrect={toggleCorrect}
              addOption={addOption}
              removeOption={removeOption}
              editingId={editingId}
              formError={formError}
              onSubmit={submitForm}
              onCancel={cancelEdit}
              onEdit={startEdit}
              onDelete={deleteQuestion}
            />
          )}

          {!loading && mode === "play" && (
            <PlayView
              questions={questions}
              currentQ={currentQ}
              idx={idx}
              order={order}
              selected={selected}
              answered={answered}
              score={score}
              finished={finished}
              onPickSingle={pickSingle}
              onToggleMulti={toggleMulti}
              onSubmitMulti={submitMulti}
              onNext={nextCard}
              onRestart={startPlay}
              onGoEdit={() => setMode("edit")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EditView({ questions, form, setForm, setType, toggleCorrect, addOption, removeOption, editingId, formError, onSubmit, onCancel, onEdit, onDelete }) {
  return (
    <div>
      <form onSubmit={onSubmit} className="mb-8">
        <h2 className="body-font font-semibold text-base mb-3" style={{ color: INK }}>
          {editingId ? "カードを編集" : "新しいカードを追加"}
        </h2>

        <label className="block body-font text-xs font-semibold mb-1" style={{ color: INK_SOFT }}>
          問題文
        </label>
        <input
          type="text"
          value={form.question}
          onChange={(e) => setForm({ ...form, question: e.target.value })}
          placeholder="例: 日本で一番高い山は?"
          className="w-full body-font text-sm px-3 py-2 rounded mb-4 bg-white/70"
          style={{ border: `1px solid ${PAPER_EDGE}`, color: INK }}
        />

        <label className="block body-font text-xs font-semibold mb-2" style={{ color: INK_SOFT }}>
          出題タイプ
        </label>
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setType("single")}
            className="seg-btn flex-1 body-font text-sm px-3 py-2 rounded flex items-center justify-center gap-1.5"
            style={{
              backgroundColor: form.type === "single" ? INK : "white",
              color: form.type === "single" ? CARD : INK_SOFT,
              border: `1px solid ${form.type === "single" ? INK : PAPER_EDGE}`,
            }}
          >
            <Circle size={14} /> 単一選択(正解1つ)
          </button>
          <button
            type="button"
            onClick={() => setType("multiple")}
            className="seg-btn flex-1 body-font text-sm px-3 py-2 rounded flex items-center justify-center gap-1.5"
            style={{
              backgroundColor: form.type === "multiple" ? INK : "white",
              color: form.type === "multiple" ? CARD : INK_SOFT,
              border: `1px solid ${form.type === "multiple" ? INK : PAPER_EDGE}`,
            }}
          >
            <CheckSquare size={14} /> 複数選択(正解複数可)
          </button>
        </div>

        <div className="flex items-center justify-between mb-2">
          <label className="block body-font text-xs font-semibold" style={{ color: INK_SOFT }}>
            選択肢
            {form.type === "single" ? "(正解を1つ選んでください)" : "(正解をすべて選んでください)"}
          </label>
          <span className="mono-font text-xs" style={{ color: INK_SOFT }}>
            {form.options.length} / {MAX_OPTIONS}
          </span>
        </div>
        <div className="space-y-2 mb-2">
          {form.options.map((opt, i) => {
            const isCorrect = form.correct.includes(i);
            return (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleCorrect(i)}
                  aria-label={`選択肢${letterFor(i)}を正解に${isCorrect ? "しない" : "する"}`}
                  aria-pressed={isCorrect}
                  className="opt-btn shrink-0 w-8 h-8 rounded flex items-center justify-center font-bold mono-font text-sm"
                  style={{
                    backgroundColor: isCorrect ? GOOD : "white",
                    color: isCorrect ? "white" : INK_SOFT,
                    border: `1px solid ${isCorrect ? GOOD : PAPER_EDGE}`,
                  }}
                >
                  {letterFor(i)}
                </button>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const next = [...form.options];
                    next[i] = e.target.value;
                    setForm({ ...form, options: next });
                  }}
                  placeholder={`選択肢 ${letterFor(i)}`}
                  className="flex-1 body-font text-sm px-3 py-2 rounded bg-white/70"
                  style={{ border: `1px solid ${PAPER_EDGE}`, color: INK }}
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  disabled={form.options.length <= MIN_OPTIONS}
                  aria-label={`選択肢${letterFor(i)}を削除`}
                  className="opt-btn shrink-0 w-8 h-8 rounded flex items-center justify-center disabled:opacity-30"
                  style={{ border: `1px solid ${PAPER_EDGE}`, color: BAD }}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addOption}
          disabled={form.options.length >= MAX_OPTIONS}
          className="tab-btn body-font text-sm px-3 py-1.5 rounded mb-4 inline-flex items-center gap-1.5 disabled:opacity-30"
          style={{ border: `1px dashed ${INK_SOFT}`, color: INK_SOFT }}
        >
          <Plus size={14} /> 選択肢を追加
        </button>

        {formError && (
          <p className="body-font text-sm mb-3" style={{ color: BAD }}>
            {formError}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            className="tab-btn body-font font-semibold text-sm px-4 py-2 rounded flex items-center gap-1.5"
            style={{ backgroundColor: INK, color: CARD }}
          >
            {editingId ? <Check size={16} /> : <Plus size={16} />}
            {editingId ? "更新する" : "カードを追加"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={onCancel}
              className="tab-btn body-font text-sm px-4 py-2 rounded flex items-center gap-1.5"
              style={{ border: `1px solid ${PAPER_EDGE}`, color: INK_SOFT }}
            >
              <X size={16} /> キャンセル
            </button>
          )}
        </div>
      </form>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="body-font font-semibold text-base" style={{ color: INK }}>
            カード一覧
          </h2>
          <span className="mono-font text-xs" style={{ color: INK_SOFT }}>
            {questions.length} 枚
          </span>
        </div>

        {questions.length === 0 && (
          <p className="body-font text-sm py-6 text-center" style={{ color: INK_SOFT }}>
            まだカードがありません。上のフォームから追加してください。
          </p>
        )}

        <div className="space-y-2">
          {questions.map((q, i) => (
            <div
              key={q.id}
              className="rounded p-3 flex items-start justify-between gap-3"
              style={{ backgroundColor: CARD_ALT, border: `1px solid ${PAPER_EDGE}` }}
            >
              <div className="min-w-0">
                <p className="body-font text-sm font-medium truncate" style={{ color: INK }}>
                  <span className="mono-font mr-2" style={{ color: INK_SOFT }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {q.question}
                  <span
                    className="mono-font ml-2 px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: q.type === "multiple" ? "#DDCF9F" : "transparent", fontSize: "10px", color: INK_SOFT }}
                  >
                    {q.type === "multiple" ? "複数選択" : "単一選択"}
                  </span>
                </p>
                <p className="body-font text-xs mt-1" style={{ color: GOOD }}>
                  正解: {q.correct.map((c) => `${letterFor(c)}. ${q.options[c]}`).join(" / ")}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => onEdit(q)}
                  aria-label="編集"
                  className="opt-btn w-8 h-8 rounded flex items-center justify-center"
                  style={{ border: `1px solid ${PAPER_EDGE}`, color: INK }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => onDelete(q.id)}
                  aria-label="削除"
                  className="opt-btn w-8 h-8 rounded flex items-center justify-center"
                  style={{ border: `1px solid ${PAPER_EDGE}`, color: BAD }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayView({
  questions,
  currentQ,
  idx,
  order,
  selected,
  answered,
  score,
  finished,
  onPickSingle,
  onToggleMulti,
  onSubmitMulti,
  onNext,
  onRestart,
  onGoEdit,
}) {
  if (questions.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="body-font text-sm mb-4" style={{ color: INK_SOFT }}>
          プレイするにはまずカードを作りましょう。
        </p>
        <button
          onClick={onGoEdit}
          className="tab-btn body-font font-semibold text-sm px-4 py-2 rounded inline-flex items-center gap-1.5"
          style={{ backgroundColor: INK, color: CARD }}
        >
          <Plus size={16} /> カードを作る
        </button>
      </div>
    );
  }

  if (!order.length) {
    return (
      <div className="text-center py-10">
        <button
          onClick={onRestart}
          className="tab-btn body-font font-semibold text-sm px-5 py-2.5 rounded inline-flex items-center gap-1.5"
          style={{ backgroundColor: INK, color: CARD }}
        >
          <Play size={16} /> クイズを始める ({questions.length}問)
        </button>
      </div>
    );
  }

  if (finished) {
    const pct = Math.round((score / order.length) * 100);
    return (
      <div className="text-center py-6">
        <p className="mono-font text-xs mb-1" style={{ color: INK_SOFT }}>
          RESULT
        </p>
        <p className="text-5xl font-bold mono-font mb-2" style={{ color: INK }}>
          {score} / {order.length}
        </p>
        <p className="body-font text-sm mb-6" style={{ color: INK_SOFT }}>
          正答率 {pct}%
        </p>
        <button
          onClick={onRestart}
          className="tab-btn body-font font-semibold text-sm px-4 py-2 rounded inline-flex items-center gap-1.5"
          style={{ backgroundColor: INK, color: CARD }}
        >
          <RotateCcw size={16} /> もう一度
        </button>
      </div>
    );
  }

  const isMultiple = currentQ.type === "multiple";
  const pickedArr = isMultiple ? (Array.isArray(selected) ? selected : []) : selected === null ? [] : [selected];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="mono-font text-xs font-semibold" style={{ color: INK_SOFT }}>
          CARD {idx + 1} / {order.length}
        </span>
        <span className="mono-font text-xs" style={{ color: GOOD }}>
          {"I".repeat(score) || "–"}
        </span>
      </div>

      <p className="body-font text-lg font-semibold mb-1.5" style={{ color: INK }}>
        {currentQ.question}
      </p>
      {isMultiple && (
        <p className="body-font text-xs mb-4 flex items-center gap-1" style={{ color: INK_SOFT }}>
          <CheckSquare size={12} /> 当てはまるものをすべて選んでください
        </p>
      )}
      {!isMultiple && <div className="mb-4" />}

      <div className="space-y-2 mb-5">
        {currentQ.options.map((opt, i) => {
          const isCorrect = currentQ.correct.includes(i);
          const isPicked = pickedArr.includes(i);
          let bg = "white";
          let border = PAPER_EDGE;
          let color = INK;
          if (answered) {
            if (isCorrect) {
              bg = GOOD;
              border = GOOD;
              color = "white";
            } else if (isPicked) {
              bg = BAD;
              border = BAD;
              color = "white";
            }
          } else if (isMultiple && isPicked) {
            bg = "#DDCF9F";
            border = INK;
          }
          return (
            <button
              key={i}
              onClick={() => (isMultiple ? onToggleMulti(i) : onPickSingle(i))}
              disabled={answered}
              className="opt-btn w-full text-left flex items-center gap-3 px-4 py-3 rounded body-font text-sm"
              style={{ backgroundColor: bg, border: `1px solid ${border}`, color }}
            >
              <span
                className="mono-font font-bold w-6 h-6 rounded flex items-center justify-center shrink-0 text-xs"
                style={{
                  backgroundColor: answered || (isMultiple && isPicked) ? "rgba(255,255,255,0.3)" : CARD_ALT,
                  color: answered ? color : INK_SOFT,
                }}
              >
                {letterFor(i)}
              </span>
              {opt}
            </button>
          );
        })}
      </div>

      {isMultiple && !answered && (
        <button
          onClick={onSubmitMulti}
          disabled={pickedArr.length === 0}
          className="tab-btn body-font font-semibold text-sm px-4 py-2 rounded inline-flex items-center gap-1.5 disabled:opacity-40"
          style={{ backgroundColor: INK, color: CARD }}
        >
          <Check size={16} /> 解答する
        </button>
      )}

      {answered && (
        <button
          onClick={onNext}
          className="tab-btn body-font font-semibold text-sm px-4 py-2 rounded inline-flex items-center gap-1.5"
          style={{ backgroundColor: INK, color: CARD }}
        >
          {idx + 1 >= order.length ? "結果を見る" : "次のカード"} <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
