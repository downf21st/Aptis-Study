(() => {
  "use strict";
  const $ = (s) => document.querySelector(s),
    select = $("#set-select"),
    parts = $("#parts"),
    output = $("#exercise"),
    status = $("#message");
  const root = "../data/writing/",
    cache = new Map();
  let catalog = [],
    guide = [],
    extra = [],
    current = null,
    part = 1,
    request = 0;
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text != null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  async function json(path) {
    const r = await fetch(path);
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    return r.json();
  }
  function textBlock(text, cls) {
    const n = el("div", text, cls);
    n.style.whiteSpace = "pre-wrap";
    return n;
  }
  function tabs() {
    parts.replaceChildren();
    for (let p = 1; p <= 4; p++) {
      const b = el("button", `Part ${p}`, "part-button");
      b.type = "button";
      b.setAttribute("aria-pressed", String(p === part));
      b.onclick = () => {
        part = p;
        render();
      };
      parts.append(b);
    }
  }
  async function load(id) {
    const seq = ++request;
    status.hidden = false;
    status.textContent = "Đang tải đề…";
    output.hidden = true;
    try {
      if (!cache.has(id)) {
        const [questions, audit] = await Promise.all([
          json(`${root}sets/set-${id}/questions.json`),
          json("../data/sample-answer-audit.json"),
        ]);
        const record = audit.writing.find((x) => x.id === Number(id));
        let admin = null;
        if (record?.admin_sample_file)
          admin = await json("../" + record.admin_sample_file);
        cache.set(id, { questions, admin, record });
      }
      if (seq !== request) return;
      current = cache.get(id);
      part = 1;
      tabs();
      render();
    } catch (e) {
      if (seq === request)
        status.textContent = `Không tải được đề: ${e.message}`;
    }
  }
  function sample(container, title, value, note) {
    if (!value || !String(value).trim()) return false;
    const details = el("details", null, "sample");
    details.append(
      el("summary", title),
      el("p", note),
      textBlock(value, "sample-text"),
    );
    container.append(details);
    return true;
  }
  function editor(container, label, id, limit) {
    const wrap = el("div", null, "writing-prompt"),
      labelEl = el("label", label),
      area = document.createElement("textarea"),
      count = el("span", "", "word-count"),
      saved = el("span", "", "save-state"),
      meta = el("div", null, "writing-meta");
    const storage = `aptis-writing-v1:${current.questions.source_set_id}:${part}:${id}`;
    area.id = `draft-${id}`;
    labelEl.htmlFor = area.id;
    area.rows = part === 1 ? 2 : 5;
    area.placeholder = "Viết câu trả lời của bạn ở đây…";
    let available = true;
    try {
      area.value = localStorage.getItem(storage) || "";
    } catch {
      available = false;
    }
    function countWords() {
      const value = area.value.trim();
      count.textContent = `${value ? value.split(/\s+/u).length : 0} từ${limit?.min != null ? ` · Gợi ý nguồn: ${limit.min}–${limit.max} từ` : ""}`;
    }
    function save() {
      countWords();
      try {
        localStorage.setItem(storage, area.value);
        saved.textContent = "Đã lưu trên trình duyệt";
      } catch {
        saved.textContent = "Không lưu được trên trình duyệt";
      }
    }
    countWords();
    saved.textContent = available
      ? "Bản nháp lưu trên trình duyệt"
      : "Không thể truy cập bộ nhớ trình duyệt";
    area.addEventListener("input", save);
    meta.append(count, saved);
    wrap.append(labelEl, area, meta);
    container.append(wrap);
    return wrap;
  }
  function render() {
    if (!current) return;
    tabs();
    status.hidden = true;
    output.hidden = false;
    output.replaceChildren();
    const { questions, admin, record } = current,
      section = questions.sections.find((s) => s.part === part),
      card = el("article", null, "exercise-card");
    if (!section) {
      card.append(el("p", "Không có phần này trong dữ liệu nguồn."));
      output.append(card);
      return;
    }
    card.append(
      el(
        "p",
        `${questions.set_title} · Mã bộ ${questions.source_set_id}`,
        "eyebrow",
      ),
      el("h3", `Writing · Part ${part}`),
    );
    for (const q of section.questions) {
      const m = q.metadata || {};
      card.append(el("p", `Mã câu ${q.id}`, "eyebrow"));
      if (q.stem) card.append(textBlock(q.stem, "stem"));
      if (m.instructions) card.append(textBlock(m.instructions, "stem"));
      if (m.context) card.append(textBlock(m.context, "stem"));
      if (m.email) {
        const email = el("div", null, "source-note");
        for (const field of ["greeting", "body", "sign_off"])
          if (m.email[field]) email.append(textBlock(m.email[field]));
        card.append(email);
      }
      if (part === 1) {
        (m.fields || []).forEach((f, i) =>
          editor(card, f.label || `Câu ${i + 1}`, `${q.id}-field-${i}`),
        );
      }
      if (part === 2) {
        const box = editor(
          card,
          m.scenario || "Câu trả lời",
          `${q.id}-response`,
          m.word_limit,
        );
        if (m.hints) box.prepend(el("p", m.hints, "stem"));
        const match = guide.find(
          (x) =>
            x.source_set_id === questions.source_set_id &&
            x.source_question_id === q.id &&
            x.part === 2,
        );
        if (match)
          sample(
            box,
            "Ví dụ từ tài liệu hướng dẫn",
            match.sample_answer,
            "Ví dụ khớp câu hỏi và tên câu lạc bộ; chưa được chấm độc lập.",
          );
      }
      if (part === 3) {
        (m.questions || []).forEach((sub, i) => {
          const box = editor(
            card,
            sub.prompt || `Câu ${i + 1}`,
            `${q.id}-question-${i}`,
            sub.word_limit,
          );
          if (questions.source_set_id === 226 && (i === 0 || i === 2))
            box.append(
              el(
                "p",
                "Nguồn dùng cùng một bài mẫu cho câu 1 và câu 3 dù đề khác nhau; cần kiểm tra thêm.",
                "sample-note",
              ),
            );
          if (questions.source_set_id === 226 && i === 2) {
            box.append(
              el(
                "p",
                "Nguồn có mẫu trùng câu 1; chưa đủ căn cứ gắn mẫu này với câu hỏi.",
                "sample-note",
              ),
            );
          } else if (
            !sample(
              box,
              "Bài mẫu trong dữ liệu đề",
              sub.sample_answer,
              "Bài mẫu từ nguồn, chưa được chấm độc lập.",
            )
          )
            box.append(
              el(
                "p",
                "Dữ liệu đề không có bài mẫu cho câu này.",
                "sample-note",
              ),
            );
        });
      }
      if (part === 4) {
        for (let i = 1; i <= 2; i++) {
          const task = m[`task${i}`];
          if (!task) continue;
          const box = editor(
            card,
            `Task ${i}: ${task.instruction || ""}`,
            `${q.id}-task-${i}`,
            task.word_limit,
          );
          sample(
            box,
            "Bài mẫu trong dữ liệu đề",
            task.sample_answer,
            "Bài mẫu từ nguồn, chưa được chấm độc lập.",
          );
          if (
            questions.source_set_id === 229 &&
            i === 1 &&
            extra.some(
              (x) => x.source_set_id === 229 && x.part === 4 && x.task === 1,
            )
          ) {
            const example = extra.find(
              (x) => x.source_set_id === 229 && x.part === 4 && x.task === 1,
            );
            sample(
              box,
              "Ví dụ thư thân mật từ tài liệu hướng dẫn",
              example.source_excerpt,
              "Ví dụ hướng dẫn khớp nội dung email; không phải mẫu Admin hay bài đã chấm.",
            );
          }
        }
      }
    }
    const adminEntry = admin?.samples?.find((x) => x.part === part);
    if (adminEntry) {
      card.append(
        el(
          "p",
          "Có mẫu Admin lưu theo phần, nhưng chưa đủ bằng chứng đối chiếu với từng câu nên chưa hiển thị.",
          "sample-note",
        ),
      );
    } else if (record?.admin_sample_file)
      card.append(
        el("p", "Không có mẫu Admin hiển thị cho phần này.", "sample-note"),
      );
    else
      card.append(
        el("p", "Không có mẫu Admin đã xác nhận cho phần này.", "sample-note"),
      );
    const actions = el("div", null, "exercise-actions"),
      prev = el("button", "← Part trước"),
      next = el("button", "Part tiếp →", "next");
    prev.disabled = part === 1;
    next.disabled = part === 4;
    prev.onclick = () => {
      part--;
      render();
    };
    next.onclick = () => {
      part++;
      render();
    };
    actions.append(prev, next);
    card.append(actions);
    output.append(card);
  }
  select.onchange = () => load(select.value);
  (async () => {
    try {
      const [manifest, g] = await Promise.all([
        json(root + "batch-1/manifest.json"),
        json(root + "guidance-sample-matches.json"),
      ]);
      catalog = manifest.catalog;
      guide = g.matches;
      extra = g.additional_references;
      catalog.forEach((x) => {
        const o = el(
          "option",
          `${x.position}. ${x.title} · ID ${x.source_set_id}`,
        );
        o.value = x.source_set_id;
        select.append(o);
      });
      await load(select.value);
    } catch (e) {
      status.textContent = `Không tải được danh sách đề: ${e.message}`;
    }
  })();
})();
