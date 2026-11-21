(() => {
  "use strict";
  const $ = (s) => document.querySelector(s),
    parts = $("#parts"),
    select = $("#exercise-select"),
    output = $("#exercise"),
    message = $("#message");
  const state = {
    part: 1,
    index: 0,
    cache: new Map(),
    selections: new Map(),
    orders: new Map(),
    checked: new Set(),
    request: 0,
  };
  const descriptions = [
    "Điền từ",
    "Sắp xếp câu",
    "Ghép nhận định",
    "Ghép tiêu đề",
  ];
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text != null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const key = (q) => `${state.part}:${q.source_id}`;
  function buttons() {
    parts.replaceChildren();
    descriptions.forEach((label, i) => {
      const b = el("button", null, "part-button");
      b.type = "button";
      b.setAttribute("aria-pressed", String(i + 1 === state.part));
      b.append(el("strong", `Part ${i + 1}`), el("span", label));
      b.onclick = () => open(i + 1);
      parts.append(b);
    });
  }
  async function open(part) {
    state.part = part;
    state.index = 0;
    const request = ++state.request;
    buttons();
    select.disabled = true;
    output.hidden = true;
    message.hidden = false;
    message.textContent = "Đang tải bài đọc…";
    try {
      if (!state.cache.has(part)) {
        const response = await fetch(
          `../data/reading/practice-${part}/normalized.json`,
        );
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.questions)) throw Error("Dữ liệu không hợp lệ");
        state.cache.set(part, data.questions);
      }
      if (request !== state.request) return;
      const questions = state.cache.get(part);
      select.replaceChildren();
      questions.forEach((q, i) => {
        const o = el(
          "option",
          `Bài ${i + 1} · ID ${q.source_id} · ${q.title || ""}`,
        );
        o.value = i;
        select.append(o);
      });
      if (!questions.length) throw Error("Chưa có bài đọc");
      select.disabled = false;
      render();
    } catch (e) {
      if (request === state.request)
        message.textContent = `Không tải được dữ liệu. Hãy chạy ứng dụng qua máy chủ cục bộ. ${e.message}`;
    }
  }
  function sourceContent(html) {
    const parsed = new DOMParser().parseFromString(html, "text/html"),
      out = el("div", null, "explanation-text");
    function copy(src, dst) {
      for (const child of src.childNodes) {
        if (child.nodeType === Node.TEXT_NODE)
          dst.append(document.createTextNode(child.textContent));
        else if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.tagName === "BR") dst.append(document.createElement("br"));
          else {
            const n = document.createElement(
              ["STRONG", "B"].includes(child.tagName) ? "strong" : "span",
            );
            copy(child, n);
            dst.append(n);
            if (["P", "LI"].includes(child.tagName))
              dst.append(
                document.createElement("br"),
                document.createElement("br"),
              );
          }
        }
      }
    }
    copy(parsed.body, out);
    return out;
  }
  function render() {
    const all = state.cache.get(state.part),
      q = all[state.index],
      c = q.content || {},
      k = key(q),
      selected = state.selections.get(k) || {},
      checked = state.checked.has(k);
    select.value = state.index;
    $("#part-label").textContent = `READING · PART ${state.part}`;
    $("#exercise-heading").textContent = `Bài luyện tập · ${all.length} bài`;
    message.hidden = true;
    output.hidden = false;
    output.replaceChildren();
    const card = el("article", null, "exercise-card");
    card.append(
      el(
        "div",
        `BÀI ${state.index + 1} / ${all.length} · Mã nguồn: ${q.source_id} · Thứ tự nguồn: ${q.source_order ?? "không có"}`,
        "exercise-top",
      ),
      el("h3", q.title || `Bài ${state.index + 1}`),
    );
    if (q.stem && q.stem !== q.title) card.append(el("p", q.stem, "stem"));
    if (state.part === 3) {
      const passage = el("section", null, "reading-passages");
      (c.options || []).forEach((text, i) => {
        passage.append(
          el("h4", c.names?.[i] || `Đoạn ${i + 1}`),
          el("p", text),
        );
      });
      card.append(passage);
    }
    let groups = [];
    if (state.part === 1)
      groups = (c.paragraphs || []).map((s, i) => ({
        text: s.replace(/\[blank\]/gi, "______"),
        choices: c.choices?.[i] || [],
      }));
    if (state.part === 2)
      groups = (c.sentences || [])
        .map((s, i) => ({ text: s, index: i }))
        .filter((x) => x.text != null);
    if (state.part === 3)
      groups = (c.questions || []).map((s) => ({
        text: s,
        choices: c.names || [],
      }));
    if (state.part === 4)
      groups = (c.paragraphs || []).map((s) => ({
        text: s,
        choices: c.headings || [],
      }));
    const answer = q.answer_key || {};
    if (state.part === 2) renderOrdering(card, groups, k, answer, checked);
    else
      groups.forEach((g, i) => {
        const group = el("fieldset", null, "question-group");
        group.append(
          el(
            "legend",
            state.part === 2 ? `Vị trí ${i + 1}` : `${i + 1}. ${g.text}`,
          ),
        );
        const options =
          state.part === 2 ? groups.map((x) => x.text) : g.choices;
        const sel = document.createElement("select");
        sel.setAttribute(
          "aria-label",
          state.part === 2
            ? `Chọn câu cho vị trí ${i + 1}`
            : `Chọn đáp án câu ${i + 1}`,
        );
        const placeholder = el("option", "Chọn đáp án");
        placeholder.value = "";
        sel.append(placeholder);
        options.forEach((text, j) => {
          const o = el("option", text);
          o.value = String(j);
          sel.append(o);
        });
        sel.value = selected[i] ?? "";
        sel.onchange = () => {
          selected[i] = sel.value;
          state.selections.set(k, selected);
          state.checked.delete(k);
          render();
        };
        group.append(sel);
        if (checked) {
          const raw =
            state.part === 2
              ? answer.sentences?.filter((x) => x != null)[i]
              : answer.correct_answers?.[i];
          const expected =
            state.part === 2
              ? raw
              : raw != null && /^\d+$/.test(String(raw))
                ? options[Number(raw)]
                : undefined;
          const choice =
            selected[i] !== undefined && selected[i] !== ""
              ? options[Number(selected[i])]
              : undefined;
          const result = el("div", null, "reading-result");
          if (expected == null)
            result.append(el("span", "Nguồn không có đáp án."));
          else {
            const status =
              choice === undefined
                ? "Chưa chọn"
                : choice === expected
                  ? "Đúng"
                  : "Sai";
            result.append(
              el(
                "span",
                status,
                status === "Đúng"
                  ? "answer-badge correct"
                  : status === "Sai"
                    ? "answer-badge incorrect"
                    : "answer-badge unanswered",
              ),
              el("div", `✓ Đáp án nguồn: ${expected}`, "reading-correct"),
            );
            if (choice !== undefined && choice !== expected)
              result.append(
                el("div", `✕ Bạn chọn: ${choice}`, "reading-incorrect"),
              );
          }
          group.append(result);
        }
        card.append(group);
      });
    if (checked) {
      const box = el("section", null, "results");
      box.append(
        el("strong", "Đáp án từ nguồn"),
        el("p", "Đáp án và lời giải chưa được xác minh độc lập."),
      );
      if (answer.explanation?.trim()) {
        box.append(
          el("strong", "Lời giải từ nguồn"),
          sourceContent(answer.explanation),
        );
      } else box.append(el("p", "Nguồn không cung cấp lời giải cho bài này."));
      card.append(box);
    }
    const actions = el("div", null, "exercise-actions");
    const prev = el("button", "← Bài trước"),
      check = el("button", "Kiểm tra đáp án", "check"),
      next = el("button", "Bài tiếp →", "next");
    prev.disabled = state.index === 0;
    next.disabled = state.index === all.length - 1;
    prev.onclick = () => {
      state.index--;
      render();
    };
    next.onclick = () => {
      state.index++;
      render();
    };
    check.onclick = () => {
      state.checked.add(k);
      render();
    };
    actions.append(prev, check, next);
    card.append(actions);
    output.append(card);
  }
  function renderOrdering(card, groups, k, answer, checked) {
    const order = state.orders.get(k) || groups.map((_, i) => i);
    state.orders.set(k, order);
    card.append(
      el("p", "Kéo các câu để đổi vị trí, hoặc dùng nút lên và xuống.", "stem"),
    );
    const list = el("ol", null, "order-list");
    function move(from, to, restoreFocus = false) {
      if (from === to || to < 0 || to >= order.length) return;
      const [item] = order.splice(from, 1);
      order.splice(to, 0, item);
      state.checked.delete(k);
      render();
      if (restoreFocus) {
        const buttons = output
          .querySelectorAll(".order-item")
          [to].querySelectorAll(".order-controls button");
        (buttons[to > from ? 1 : 0].disabled
          ? buttons[to > from ? 0 : 1]
          : buttons[to > from ? 1 : 0]
        ).focus();
      }
    }
    order.forEach((sourceIndex, position) => {
      const item = el("li", null, "order-item"),
        handle = el("button", "⠿", "order-handle"),
        number = el("span", String(position + 1), "order-number"),
        text = el("span", groups[sourceIndex].text, "order-text"),
        controls = el("div", null, "order-controls");
      handle.type = "button";
      handle.setAttribute("aria-label", "Kéo câu ở vị trí " + (position + 1));
      let dragging = false;
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        dragging = true;
        handle.setPointerCapture(event.pointerId);
        item.classList.add("dragging");
      });
      handle.addEventListener("pointerup", (event) => {
        if (!dragging) return;
        dragging = false;
        item.classList.remove("dragging");
        const target = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest(".order-item");
        if (target && list.contains(target))
          move(position, Array.from(list.children).indexOf(target));
      });
      handle.addEventListener("pointercancel", () => {
        dragging = false;
        item.classList.remove("dragging");
      });
      const up = el("button", "↑"),
        down = el("button", "↓");
      up.type = down.type = "button";
      up.disabled = position === 0;
      down.disabled = position === order.length - 1;
      up.setAttribute("aria-label", "Đưa câu " + (position + 1) + " lên");
      down.setAttribute("aria-label", "Đưa câu " + (position + 1) + " xuống");
      up.onclick = () => move(position, position - 1, true);
      down.onclick = () => move(position, position + 1, true);
      controls.append(up, down);
      item.append(handle, number, text, controls);
      if (checked) {
        const expected = answer.sentences?.filter((x) => x != null)[position];
        if (expected != null) {
          const correct = groups[sourceIndex].text === expected;
          item.classList.add(correct ? "order-correct" : "order-incorrect");
          item.append(
            el(
              "span",
              correct ? "✓ Đúng" : "✕ Sai",
              correct ? "order-status correct" : "order-status incorrect",
            ),
          );
        } else item.append(el("span", "Nguồn không có đáp án", "order-status"));
      }
      list.append(item);
    });
    card.append(list);
    if (checked && Array.isArray(answer.sentences)) {
      const box = el("div", null, "reading-correct");
      box.append(el("strong", "Thứ tự theo nguồn"));
      const list = el("ol");
      answer.sentences
        .filter((x) => x != null)
        .forEach((sentence) => list.append(el("li", sentence)));
      box.append(list);
      card.append(box);
    }
  }
  select.onchange = () => {
    state.index = Number(select.value);
    render();
  };
  buttons();
  open(1);
})();
