"use strict";
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
    if (a.length !== b.length)
        return false;
    const as = [...a].sort().join(",");
    const bs = [...b].sort().join(",");
    return as === bs;
}
function QuizBoxApp() {
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
        try {
            const raw = localStorage.getItem("quiz-box:questions");
            if (raw) {
                const parsed = JSON.parse(raw);
                // migrate legacy single-number "correct" field to array form
                const migrated = parsed.map((q) => ({
                    ...q,
                    type: q.type || "single",
                    correct: Array.isArray(q.correct) ? q.correct : [q.correct],
                }));
                setQuestions(migrated);
            }
            else {
                setQuestions(STARTER);
            }
        }
        catch (e) {
            setQuestions(STARTER);
        }
        finally {
            setLoading(false);
            hydrated.current = true;
        }
    }, []);
    useEffect(() => {
        if (!hydrated.current)
            return;
        try {
            localStorage.setItem("quiz-box:questions", JSON.stringify(questions));
        }
        catch (e) {
            // ignore save errors silently, data still in memory
        }
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
        if (editingId === id)
            cancelEdit();
    }
    function setType(type) {
        setForm((f) => { var _a; return ({ ...f, type, correct: type === "single" ? [(_a = f.correct[0]) !== null && _a !== void 0 ? _a : 0] : f.correct }); });
    }
    function toggleCorrect(i) {
        setForm((f) => {
            if (f.type === "single")
                return { ...f, correct: [i] };
            const has = f.correct.includes(i);
            const next = has ? f.correct.filter((c) => c !== i) : [...f.correct, i];
            return { ...f, correct: next };
        });
    }
    function addOption() {
        setForm((f) => {
            if (f.options.length >= MAX_OPTIONS)
                return f;
            return { ...f, options: [...f.options, ""] };
        });
    }
    function removeOption(i) {
        setForm((f) => {
            if (f.options.length <= MIN_OPTIONS)
                return f;
            const options = f.options.filter((_, idx) => idx !== i);
            let correct = f.correct.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c));
            if (f.type === "single" && correct.length === 0)
                correct = [0];
            return { ...f, options, correct };
        });
    }
    function submitForm(e) {
        e.preventDefault();
        const q = form.question.trim();
        const opts = form.options.map((o) => o.trim());
        if (!q)
            return setFormError("問題文を入力してください");
        if (opts.some((o) => !o))
            return setFormError("すべての選択肢を入力してください");
        if (form.correct.length === 0)
            return setFormError("正解を少なくとも1つ選んでください");
        if (editingId) {
            setQuestions((qs) => qs.map((item) => item.id === editingId
                ? { ...item, question: q, type: form.type, options: opts, correct: form.correct }
                : item));
        }
        else {
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
        if (answered)
            return;
        const q = questions[order[idx]];
        setSelected(i);
        setAnswered(true);
        if (sameSet([i], q.correct))
            setScore((s) => s + 1);
    }
    function toggleMulti(i) {
        if (answered)
            return;
        setSelected((prev) => {
            const cur = Array.isArray(prev) ? prev : [];
            return cur.includes(i) ? cur.filter((c) => c !== i) : [...cur, i];
        });
    }
    function submitMulti() {
        if (answered)
            return;
        const q = questions[order[idx]];
        const picked = Array.isArray(selected) ? selected : [];
        setAnswered(true);
        if (picked.length > 0 && sameSet(picked, q.correct))
            setScore((s) => s + 1);
    }
    function nextCard() {
        if (idx + 1 >= order.length) {
            setFinished(true);
        }
        else {
            setIdx((i) => i + 1);
            setSelected(null);
            setAnswered(false);
        }
    }
    const currentQ = mode === "play" && order.length ? questions[order[idx]] : null;
    return (React.createElement("div", { className: "min-h-screen w-full flex justify-center px-4 py-8", style: {
            backgroundColor: "#DCD2AE",
            backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.035) 0px, rgba(0,0,0,0.035) 1px, transparent 1px, transparent 26px)",
            fontFamily: "'Special Elite', 'Courier New', monospace",
        } },
        React.createElement("style", null, `
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
      `),
        React.createElement("div", { className: "w-full max-w-2xl" },
            React.createElement("div", { className: "mb-6 text-center" },
                React.createElement("h1", { className: "text-4xl sm:text-5xl tracking-wide", style: { color: INK, textShadow: "1px 1px 0 rgba(0,0,0,0.08)" } }, "QUIZ BOX"),
                React.createElement("div", { className: "mt-2 mx-auto", style: { width: 120, height: 3, backgroundColor: RULE } }),
                React.createElement("p", { className: "mt-3 body-font text-sm", style: { color: INK_SOFT } }, "\u81EA\u5206\u3060\u3051\u306E\u30AF\u30A4\u30BA\u30AB\u30FC\u30C9\u3092\u4F5C\u3063\u3066\u3001\u904A\u307C\u3046")),
            React.createElement("div", { className: "flex gap-2 mb-[-1px] px-2 relative z-10" },
                React.createElement("button", { onClick: () => setMode("edit"), className: "tab-btn body-font font-semibold text-sm px-5 py-2.5 rounded-t-lg flex items-center gap-2", style: {
                        backgroundColor: mode === "edit" ? CARD : CARD_ALT,
                        color: INK,
                        boxShadow: mode === "edit" ? "0 -2px 6px rgba(0,0,0,0.08)" : "none",
                        border: `1px solid ${PAPER_EDGE}`,
                        borderBottom: mode === "edit" ? "1px solid " + CARD : `1px solid ${PAPER_EDGE}`,
                    } },
                    React.createElement("span", { "aria-hidden": "true" }, "\u2630"),
                    " \u7DE8\u96C6"),
                React.createElement("button", { onClick: () => (questions.length ? startPlay() : setMode("play")), className: "tab-btn body-font font-semibold text-sm px-5 py-2.5 rounded-t-lg flex items-center gap-2", style: {
                        backgroundColor: mode === "play" ? CARD : CARD_ALT,
                        color: INK,
                        boxShadow: mode === "play" ? "0 -2px 6px rgba(0,0,0,0.08)" : "none",
                        border: `1px solid ${PAPER_EDGE}`,
                        borderBottom: mode === "play" ? "1px solid " + CARD : `1px solid ${PAPER_EDGE}`,
                    } },
                    React.createElement("span", { "aria-hidden": "true" }, "\u25B6"),
                    " \u30D7\u30EC\u30A4")),
            React.createElement("div", { className: "rounded-b-lg rounded-tr-lg p-5 sm:p-7 relative", style: { backgroundColor: CARD, border: `1px solid ${PAPER_EDGE}`, boxShadow: "0 4px 14px rgba(0,0,0,0.12)" } },
                React.createElement("div", { style: { position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: RULE, opacity: 0.85 } }),
                loading && (React.createElement("p", { className: "body-font text-center py-10", style: { color: INK_SOFT } }, "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026")),
                !loading && mode === "edit" && (React.createElement(EditView, { questions: questions, form: form, setForm: setForm, setType: setType, toggleCorrect: toggleCorrect, addOption: addOption, removeOption: removeOption, editingId: editingId, formError: formError, onSubmit: submitForm, onCancel: cancelEdit, onEdit: startEdit, onDelete: deleteQuestion })),
                !loading && mode === "play" && (React.createElement(PlayView, { questions: questions, currentQ: currentQ, idx: idx, order: order, selected: selected, answered: answered, score: score, finished: finished, onPickSingle: pickSingle, onToggleMulti: toggleMulti, onSubmitMulti: submitMulti, onNext: nextCard, onRestart: startPlay, onGoEdit: () => setMode("edit") }))))));
}
function EditView({ questions, form, setForm, setType, toggleCorrect, addOption, removeOption, editingId, formError, onSubmit, onCancel, onEdit, onDelete }) {
    return (React.createElement("div", null,
        React.createElement("form", { onSubmit: onSubmit, className: "mb-8" },
            React.createElement("h2", { className: "body-font font-semibold text-base mb-3", style: { color: INK } }, editingId ? "カードを編集" : "新しいカードを追加"),
            React.createElement("label", { className: "block body-font text-xs font-semibold mb-1", style: { color: INK_SOFT } }, "\u554F\u984C\u6587"),
            React.createElement("input", { type: "text", value: form.question, onChange: (e) => setForm({ ...form, question: e.target.value }), placeholder: "\u4F8B: \u65E5\u672C\u3067\u4E00\u756A\u9AD8\u3044\u5C71\u306F?", className: "w-full body-font text-sm px-3 py-2 rounded mb-4 bg-white/70", style: { border: `1px solid ${PAPER_EDGE}`, color: INK } }),
            React.createElement("label", { className: "block body-font text-xs font-semibold mb-2", style: { color: INK_SOFT } }, "\u51FA\u984C\u30BF\u30A4\u30D7"),
            React.createElement("div", { className: "flex gap-2 mb-4" },
                React.createElement("button", { type: "button", onClick: () => setType("single"), className: "seg-btn flex-1 body-font text-sm px-3 py-2 rounded flex items-center justify-center gap-1.5", style: {
                        backgroundColor: form.type === "single" ? INK : "white",
                        color: form.type === "single" ? CARD : INK_SOFT,
                        border: `1px solid ${form.type === "single" ? INK : PAPER_EDGE}`,
                    } },
                    React.createElement("span", { "aria-hidden": "true" }, "\u25CB"),
                    " \u5358\u4E00\u9078\u629E(\u6B63\u89E31\u3064)"),
                React.createElement("button", { type: "button", onClick: () => setType("multiple"), className: "seg-btn flex-1 body-font text-sm px-3 py-2 rounded flex items-center justify-center gap-1.5", style: {
                        backgroundColor: form.type === "multiple" ? INK : "white",
                        color: form.type === "multiple" ? CARD : INK_SOFT,
                        border: `1px solid ${form.type === "multiple" ? INK : PAPER_EDGE}`,
                    } },
                    React.createElement("span", { "aria-hidden": "true" }, "\u2611"),
                    " \u8907\u6570\u9078\u629E(\u6B63\u89E3\u8907\u6570\u53EF)")),
            React.createElement("div", { className: "flex items-center justify-between mb-2" },
                React.createElement("label", { className: "block body-font text-xs font-semibold", style: { color: INK_SOFT } },
                    "\u9078\u629E\u80A2",
                    form.type === "single" ? "(正解を1つ選んでください)" : "(正解をすべて選んでください)"),
                React.createElement("span", { className: "mono-font text-xs", style: { color: INK_SOFT } },
                    form.options.length,
                    " / ",
                    MAX_OPTIONS)),
            React.createElement("div", { className: "space-y-2 mb-2" }, form.options.map((opt, i) => {
                const isCorrect = form.correct.includes(i);
                return (React.createElement("div", { key: i, className: "flex items-center gap-2" },
                    React.createElement("button", { type: "button", onClick: () => toggleCorrect(i), "aria-label": `選択肢${letterFor(i)}を正解に${isCorrect ? "しない" : "する"}`, "aria-pressed": isCorrect, className: "opt-btn shrink-0 w-8 h-8 rounded flex items-center justify-center font-bold mono-font text-sm", style: {
                            backgroundColor: isCorrect ? GOOD : "white",
                            color: isCorrect ? "white" : INK_SOFT,
                            border: `1px solid ${isCorrect ? GOOD : PAPER_EDGE}`,
                        } }, letterFor(i)),
                    React.createElement("input", { type: "text", value: opt, onChange: (e) => {
                            const next = [...form.options];
                            next[i] = e.target.value;
                            setForm({ ...form, options: next });
                        }, placeholder: `選択肢 ${letterFor(i)}`, className: "flex-1 body-font text-sm px-3 py-2 rounded bg-white/70", style: { border: `1px solid ${PAPER_EDGE}`, color: INK } }),
                    React.createElement("button", { type: "button", onClick: () => removeOption(i), disabled: form.options.length <= MIN_OPTIONS, "aria-label": `選択肢${letterFor(i)}を削除`, className: "opt-btn shrink-0 w-8 h-8 rounded flex items-center justify-center disabled:opacity-30", style: { border: `1px solid ${PAPER_EDGE}`, color: BAD } },
                        React.createElement("span", { "aria-hidden": "true" }, "\u2715"))));
            })),
            React.createElement("button", { type: "button", onClick: addOption, disabled: form.options.length >= MAX_OPTIONS, className: "tab-btn body-font text-sm px-3 py-1.5 rounded mb-4 inline-flex items-center gap-1.5 disabled:opacity-30", style: { border: `1px dashed ${INK_SOFT}`, color: INK_SOFT } },
                React.createElement("span", { "aria-hidden": "true" }, "\uFF0B"),
                " \u9078\u629E\u80A2\u3092\u8FFD\u52A0"),
            formError && (React.createElement("p", { className: "body-font text-sm mb-3", style: { color: BAD } }, formError)),
            React.createElement("div", { className: "flex gap-2" },
                React.createElement("button", { type: "submit", className: "tab-btn body-font font-semibold text-sm px-4 py-2 rounded flex items-center gap-1.5", style: { backgroundColor: INK, color: CARD } },
                    editingId ? React.createElement("span", { "aria-hidden": "true" }, "\u2713") : React.createElement("span", { "aria-hidden": "true" }, "\uFF0B"),
                    editingId ? "更新する" : "カードを追加"),
                editingId && (React.createElement("button", { type: "button", onClick: onCancel, className: "tab-btn body-font text-sm px-4 py-2 rounded flex items-center gap-1.5", style: { border: `1px solid ${PAPER_EDGE}`, color: INK_SOFT } },
                    React.createElement("span", { "aria-hidden": "true" }, "\u2715"),
                    " \u30AD\u30E3\u30F3\u30BB\u30EB")))),
        React.createElement("div", null,
            React.createElement("div", { className: "flex items-center justify-between mb-3" },
                React.createElement("h2", { className: "body-font font-semibold text-base", style: { color: INK } }, "\u30AB\u30FC\u30C9\u4E00\u89A7"),
                React.createElement("span", { className: "mono-font text-xs", style: { color: INK_SOFT } },
                    questions.length,
                    " \u679A")),
            questions.length === 0 && (React.createElement("p", { className: "body-font text-sm py-6 text-center", style: { color: INK_SOFT } }, "\u307E\u3060\u30AB\u30FC\u30C9\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u4E0A\u306E\u30D5\u30A9\u30FC\u30E0\u304B\u3089\u8FFD\u52A0\u3057\u3066\u304F\u3060\u3055\u3044\u3002")),
            React.createElement("div", { className: "space-y-2" }, questions.map((q, i) => (React.createElement("div", { key: q.id, className: "rounded p-3 flex items-start justify-between gap-3", style: { backgroundColor: CARD_ALT, border: `1px solid ${PAPER_EDGE}` } },
                React.createElement("div", { className: "min-w-0" },
                    React.createElement("p", { className: "body-font text-sm font-medium truncate", style: { color: INK } },
                        React.createElement("span", { className: "mono-font mr-2", style: { color: INK_SOFT } }, String(i + 1).padStart(2, "0")),
                        q.question,
                        React.createElement("span", { className: "mono-font ml-2 px-1.5 py-0.5 rounded", style: { backgroundColor: q.type === "multiple" ? "#DDCF9F" : "transparent", fontSize: "10px", color: INK_SOFT } }, q.type === "multiple" ? "複数選択" : "単一選択")),
                    React.createElement("p", { className: "body-font text-xs mt-1", style: { color: GOOD } },
                        "\u6B63\u89E3: ",
                        q.correct.map((c) => `${letterFor(c)}. ${q.options[c]}`).join(" / "))),
                React.createElement("div", { className: "flex gap-1 shrink-0" },
                    React.createElement("button", { onClick: () => onEdit(q), "aria-label": "\u7DE8\u96C6", className: "opt-btn w-8 h-8 rounded flex items-center justify-center", style: { border: `1px solid ${PAPER_EDGE}`, color: INK } },
                        React.createElement("span", { "aria-hidden": "true" }, "\u270E")),
                    React.createElement("button", { onClick: () => onDelete(q.id), "aria-label": "\u524A\u9664", className: "opt-btn w-8 h-8 rounded flex items-center justify-center", style: { border: `1px solid ${PAPER_EDGE}`, color: BAD } },
                        React.createElement("span", { "aria-hidden": "true" }, "\uD83D\uDDD1"))))))))));
}
function PlayView({ questions, currentQ, idx, order, selected, answered, score, finished, onPickSingle, onToggleMulti, onSubmitMulti, onNext, onRestart, onGoEdit, }) {
    if (questions.length === 0) {
        return (React.createElement("div", { className: "text-center py-10" },
            React.createElement("p", { className: "body-font text-sm mb-4", style: { color: INK_SOFT } }, "\u30D7\u30EC\u30A4\u3059\u308B\u306B\u306F\u307E\u305A\u30AB\u30FC\u30C9\u3092\u4F5C\u308A\u307E\u3057\u3087\u3046\u3002"),
            React.createElement("button", { onClick: onGoEdit, className: "tab-btn body-font font-semibold text-sm px-4 py-2 rounded inline-flex items-center gap-1.5", style: { backgroundColor: INK, color: CARD } },
                React.createElement("span", { "aria-hidden": "true" }, "\uFF0B"),
                " \u30AB\u30FC\u30C9\u3092\u4F5C\u308B")));
    }
    if (!order.length) {
        return (React.createElement("div", { className: "text-center py-10" },
            React.createElement("button", { onClick: onRestart, className: "tab-btn body-font font-semibold text-sm px-5 py-2.5 rounded inline-flex items-center gap-1.5", style: { backgroundColor: INK, color: CARD } },
                React.createElement("span", { "aria-hidden": "true" }, "\u25B6"),
                " \u30AF\u30A4\u30BA\u3092\u59CB\u3081\u308B (",
                questions.length,
                "\u554F)")));
    }
    if (finished) {
        const pct = Math.round((score / order.length) * 100);
        return (React.createElement("div", { className: "text-center py-6" },
            React.createElement("p", { className: "mono-font text-xs mb-1", style: { color: INK_SOFT } }, "RESULT"),
            React.createElement("p", { className: "text-5xl font-bold mono-font mb-2", style: { color: INK } },
                score,
                " / ",
                order.length),
            React.createElement("p", { className: "body-font text-sm mb-6", style: { color: INK_SOFT } },
                "\u6B63\u7B54\u7387 ",
                pct,
                "%"),
            React.createElement("button", { onClick: onRestart, className: "tab-btn body-font font-semibold text-sm px-4 py-2 rounded inline-flex items-center gap-1.5", style: { backgroundColor: INK, color: CARD } },
                React.createElement("span", { "aria-hidden": "true" }, "\u21BA"),
                " \u3082\u3046\u4E00\u5EA6")));
    }
    const isMultiple = currentQ.type === "multiple";
    const pickedArr = isMultiple ? (Array.isArray(selected) ? selected : []) : selected === null ? [] : [selected];
    return (React.createElement("div", null,
        React.createElement("div", { className: "flex items-center justify-between mb-4" },
            React.createElement("span", { className: "mono-font text-xs font-semibold", style: { color: INK_SOFT } },
                "CARD ",
                idx + 1,
                " / ",
                order.length),
            React.createElement("span", { className: "mono-font text-xs", style: { color: GOOD } }, "I".repeat(score) || "–")),
        React.createElement("p", { className: "body-font text-lg font-semibold mb-1.5", style: { color: INK } }, currentQ.question),
        isMultiple && (React.createElement("p", { className: "body-font text-xs mb-4 flex items-center gap-1", style: { color: INK_SOFT } },
            React.createElement("span", { "aria-hidden": "true" }, "\u2611"),
            " \u5F53\u3066\u306F\u307E\u308B\u3082\u306E\u3092\u3059\u3079\u3066\u9078\u3093\u3067\u304F\u3060\u3055\u3044")),
        !isMultiple && React.createElement("div", { className: "mb-4" }),
        React.createElement("div", { className: "space-y-2 mb-5" }, currentQ.options.map((opt, i) => {
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
                }
                else if (isPicked) {
                    bg = BAD;
                    border = BAD;
                    color = "white";
                }
            }
            else if (isMultiple && isPicked) {
                bg = "#DDCF9F";
                border = INK;
            }
            return (React.createElement("button", { key: i, onClick: () => (isMultiple ? onToggleMulti(i) : onPickSingle(i)), disabled: answered, className: "opt-btn w-full text-left flex items-center gap-3 px-4 py-3 rounded body-font text-sm", style: { backgroundColor: bg, border: `1px solid ${border}`, color } },
                React.createElement("span", { className: "mono-font font-bold w-6 h-6 rounded flex items-center justify-center shrink-0 text-xs", style: {
                        backgroundColor: answered || (isMultiple && isPicked) ? "rgba(255,255,255,0.3)" : CARD_ALT,
                        color: answered ? color : INK_SOFT,
                    } }, letterFor(i)),
                opt));
        })),
        isMultiple && !answered && (React.createElement("button", { onClick: onSubmitMulti, disabled: pickedArr.length === 0, className: "tab-btn body-font font-semibold text-sm px-4 py-2 rounded inline-flex items-center gap-1.5 disabled:opacity-40", style: { backgroundColor: INK, color: CARD } },
            React.createElement("span", { "aria-hidden": "true" }, "\u2713"),
            " \u89E3\u7B54\u3059\u308B")),
        answered && (React.createElement("button", { onClick: onNext, className: "tab-btn body-font font-semibold text-sm px-4 py-2 rounded inline-flex items-center gap-1.5", style: { backgroundColor: INK, color: CARD } },
            idx + 1 >= order.length ? "結果を見る" : "次のカード",
            " ",
            React.createElement("span", { "aria-hidden": "true" }, "\u203A")))));
}
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(QuizBoxApp, null));
