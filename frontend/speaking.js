(() => {
  "use strict";
  const $ = (s) => document.querySelector(s),
    select = $("#set-select"),
    parts = $("#parts"),
    output = $("#exercise"),
    message = $("#message");
  const cache = new Map();
  let catalog,
    current,
    part = 1,
    index = 0,
    request = 0;
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text != null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  async function get(path) {
    const r = await fetch(path);
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    return r.json();
  }
  function tabs() {
    parts.replaceChildren();
    for (let n = 1; n <= 4; n++) {
      const b = el("button", `Part ${n}`, "part-button");
      b.type = "button";
      b.setAttribute("aria-pressed", String(part === n));
      b.onclick = () => {
        part = n;
        index = 0;
        render();
      };
      parts.append(b);
    }
  }
  async function open(id) {
    const seq = ++request;
    message.hidden = false;
    message.textContent = "Đang tải đề nói…";
    output.hidden = true;
    try {
      if (!cache.has(id)) {
        const [questions, manifest] = await Promise.all([
          get(`../data/speaking/sets/set-${id}/questions.json`),
          get(`../data/speaking/sets/set-${id}/manifest.json`),
        ]);
        cache.set(id, { questions, manifest });
      }
      if (seq !== request) return;
      current = cache.get(id);
      part = 1;
      index = 0;
      render();
    } catch (e) {
      if (seq === request)
        message.textContent = `Không tải được đề nói: ${e.message}`;
    }
  }
  function render() {
    if (!current) return;
    tabs();
    const section = current.questions.sections.find((s) => s.part === part);
    output.replaceChildren();
    message.hidden = true;
    output.hidden = false;
    const card = el("article", null, "exercise-card");
    card.append(
      el(
        "p",
        `${current.questions.set_title} · Mã bộ ${current.questions.source_set_id}`,
        "eyebrow",
      ),
      el("h3", `Speaking · Part ${part}`),
    );
    if (!section) {
      card.append(el("p", "Nguồn không có phần này."));
      output.append(card);
      return;
    }
    const flat = section.questions.flatMap((q) =>
      (q.metadata?.questions || []).map((prompt, i) => ({ q, prompt, i })),
    );
    if (!flat.length) {
      card.append(el("p", "Không có câu hỏi trong dữ liệu nguồn."));
      output.append(card);
      return;
    }
    index = Math.min(index, flat.length - 1);
    const { q, prompt } = flat[index],
      m = q.metadata || {};
    card.append(
      el(
        "p",
        part === 4
          ? `Mã nguồn ${q.id}`
          : `Câu ${index + 1} / ${flat.length} · Mã nguồn ${q.id}`,
        "eyebrow",
      ),
    );
    if (q.title) card.append(el("h4", q.title));
    if (q.stem) card.append(el("p", q.stem, "stem"));
    const timing = el("div", null, "speaking-timing");
    if (m.prep_time != null)
      timing.append(el("span", `Chuẩn bị: ${m.prep_time} giây`));
    if (m.answer_time_per_question != null)
      timing.append(
        el("span", `Trả lời mỗi câu: ${m.answer_time_per_question} giây`),
      );
    if (m.total_answer_time != null)
      timing.append(
        el("span", `Trả lời tất cả câu: ${m.total_answer_time} giây`),
      );
    if (timing.childNodes.length) card.append(timing);
    const imagePaths = [
      ...(m.image_path ? [m.image_path] : []),
      ...(m.image_paths || []),
    ];
    if (!imagePaths.length && part >= 2)
      card.append(el("p", "Nguồn không có ảnh cho phần này.", "media-status"));
    if (imagePaths.length) {
      const gallery = el("div", null, "speaking-images");
      imagePaths.forEach((path, i) => {
        const figure = el("figure"),
          match = (current.manifest.images || []).find(
            (x) =>
              String(x.question_id) === String(q.id) && x.source_path === path,
          );
        if (!match?.file) {
          figure.append(
            el("p", `Không có ảnh ${i + 1} trong bản sao lưu.`, "media-status"),
          );
        } else {
          const image = document.createElement("img");
          image.src = "../" + match.file;
          image.alt = `Ảnh ${i + 1} của Part ${part}, câu nguồn ${q.id}`;
          image.onerror = () =>
            image.replaceWith(
              el(
                "p",
                `Không tải được ảnh ${i + 1} từ bản sao lưu.`,
                "media-status",
              ),
            );
          figure.append(
            image,
            el("figcaption", `Ảnh ${i + 1} · nguồn: ${path}`),
          );
        }
        gallery.append(figure);
      });
      card.append(gallery);
    }
    if (part === 4) {
      const list = el("ul", null, "speaking-questions");
      (m.questions || []).forEach((s) => list.append(el("li", s)));
      card.append(el("p", "Các câu hỏi của phần này", "eyebrow"), list);
    } else card.append(el("div", prompt, "speaking-question"));
    if (part === 4)
      card.append(
        el(
          "p",
          "Các câu hỏi trên dùng chung thời gian trả lời khi nguồn có quy định.",
          "sample-note",
        ),
      );
    card.append(
      el(
        "p",
        current.questions.source_set_id === 234
          ? "Chưa có bài mẫu được xác minh cho đề này. Mẫu lưu từ lịch sử chưa được xác nhận khớp đầy đủ."
          : "Dữ liệu đề không có bài mẫu.",
        "sample-note",
      ),
    );
    const actions = el("div", null, "exercise-actions");
    const prev = el("button", "← Câu trước"),
      next = el("button", "Câu tiếp →", "next");
    prev.disabled = index === 0;
    next.disabled = index === flat.length - 1;
    prev.onclick = () => {
      index--;
      render();
    };
    next.onclick = () => {
      index++;
      render();
    };
    if (part !== 4) actions.append(prev, next);
    const other = el("div", null, "exercise-actions");
    const previous = el("button", "← Part trước"),
      following = el("button", "Part tiếp →", "next");
    previous.disabled = part === 1;
    following.disabled = part === 4;
    previous.onclick = () => {
      part--;
      index = 0;
      render();
    };
    following.onclick = () => {
      part++;
      index = 0;
      render();
    };
    other.append(previous, following);
    card.append(actions, other);
    output.append(card);
  }
  select.onchange = () => open(select.value);
  (async () => {
    try {
      catalog = await get("../data/speaking/catalog.json");
      if (!Array.isArray(catalog.sets)) throw Error("Danh mục không hợp lệ");
      catalog.sets.forEach((s) => {
        const option = el("option", `${s.position}. ${s.title} · ID ${s.id}`);
        option.value = s.id;
        select.append(option);
      });
      if (catalog.sets.length) await open(select.value);
      else message.textContent = "Chưa có đề nói.";
    } catch (e) {
      message.textContent = `Không tải được danh mục: ${e.message}`;
    }
  })();
})();
