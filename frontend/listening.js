(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const parts = $("#parts"),
    select = $("#exercise-select"),
    message = $("#message"),
    exercise = $("#exercise");
  const state = {
    part: 1,
    index: 0,
    data: new Map(),
    selections: new Map(),
    checked: new Set(),
    request: 0,
  };
  const labels = ["Một câu hỏi", "Bốn người nói", "Hội thoại", "Bài nghe dài"];
  // Source material is rendered as text, never as executable HTML or external media.
  function htmlText(value) {
    const doc = new DOMParser().parseFromString(
      String(value || "")
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<\/p\s*>/gi, "\n\n"),
      "text/html",
    );
    return (doc.body.textContent || "").trim();
  }
  function sourceContent(value) {
    const parsed = new DOMParser().parseFromString(
      String(value || ""),
      "text/html",
    );
    const container = node("div", null, "explanation-text");
    function copy(source, target) {
      for (const child of source.childNodes) {
        if (child.nodeType === Node.TEXT_NODE)
          target.append(document.createTextNode(child.textContent));
        else if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.tagName === "BR")
            target.append(document.createElement("br"));
          else {
            const element = document.createElement(
              child.tagName === "STRONG" || child.tagName === "B"
                ? "strong"
                : "span",
            );
            copy(child, element);
            target.append(element);
            if (["P", "LI"].includes(child.tagName))
              target.append(
                document.createElement("br"),
                document.createElement("br"),
              );
          }
        }
      }
    }
    copy(parsed.body, container);
    return container;
  }
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function partButtons() {
    parts.replaceChildren();
    labels.forEach((label, i) => {
      const button = node("button", null, "part-button");
      button.type = "button";
      button.setAttribute("aria-pressed", String(state.part === i + 1));
      button.append(
        node("strong", `Part ${i + 1}`),
        node(
          "span",
          `${label}${state.data.has(i + 1) ? ` · ${state.data.get(i + 1).questions.length} bài` : ""}`,
        ),
      );
      button.addEventListener("click", () => openPart(i + 1));
      parts.append(button);
    });
  }
  async function readJSON(path) {
    const response = await fetch(path);
    if (!response.ok)
      throw new Error(`Không thể tải ${path} (HTTP ${response.status})`);
    return response.json();
  }
  async function openPart(part) {
    state.part = part;
    state.index = 0;
    const request = ++state.request;
    partButtons();
    select.disabled = true;
    exercise.hidden = true;
    message.hidden = false;
    message.textContent = `Đang tải Part ${part}…`;
    try {
      if (!state.data.has(part)) {
        const root = `../data/listening/practice-${part + 4}/`;
        const [source, keys, manifest] = await Promise.all(
          ["source-fields.json", "answer-keys.json", "manifest.json"].map(
            (file) => readJSON(root + file),
          ),
        );
        if (
          !Array.isArray(source.questions) ||
          !Array.isArray(keys.questions) ||
          !Array.isArray(manifest.media)
        )
          throw new Error("Định dạng dữ liệu không hợp lệ.");
        state.data.set(part, {
          questions: source.questions,
          keys: new Map(
            keys.questions.map((item) => [
              String(item.question_id),
              item.answer_key,
            ]),
          ),
          media: manifest.media,
          root,
        });
      }
      if (request !== state.request) return;
      const data = state.data.get(part);
      select.replaceChildren();
      data.questions.forEach((q, i) => {
        const option = node(
          "option",
          `Bài ${i + 1} · ID ${q.id}${q.title ? ` · ${q.title}` : ""}`,
        );
        option.value = String(i);
        select.append(option);
      });
      if (!data.questions.length)
        throw new Error("Phần này chưa có bài luyện tập.");
      select.disabled = false;
      partButtons();
      render();
    } catch (error) {
      if (request !== state.request) return;
      message.textContent = `Không tải được dữ liệu. Hãy mở ứng dụng qua máy chủ cục bộ tại thư mục dự án. ${error.message}`;
    }
  }
  function itemKey(q) {
    return `${state.part}:${q.id}`;
  }
  function groupsFor(q) {
    const m = q.metadata || {};
    if (state.part === 1)
      return [{ question: q.stem || "Câu hỏi", choices: m.choices || [] }];
    if (state.part === 2)
      return (m.items || []).map((item) => ({
        question: item,
        choices: m.choices || [],
      }));
    if (state.part === 3)
      return (m.statements || []).map((item) => ({
        question: item,
        choices: m.shared_choices || [],
      }));
    return (m.questions || []).map((item) => ({
      question: item.question,
      choices: item.choices || [],
    }));
  }
  function audioPath(file, root) {
    return file.startsWith("data/") ? "../" + file : root + file;
  }
  function render() {
    const data = state.data.get(state.part),
      q = data.questions[state.index],
      key = itemKey(q),
      groups = groupsFor(q);
    select.value = String(state.index);
    $("#part-label").textContent = `LISTENING · PART ${state.part}`;
    $("#exercise-heading").textContent =
      `Bài luyện tập · ${data.questions.length} bài`;
    message.hidden = true;
    exercise.hidden = false;
    exercise.replaceChildren();
    const card = node("article", null, "exercise-card"),
      top = node("div", null, "exercise-top");
    top.append(
      node("span", `BÀI ${state.index + 1} / ${data.questions.length}`),
      node(
        "span",
        `Mã nguồn: ${q.id} · Thứ tự nguồn: ${q.order ?? "không có"}`,
      ),
    );
    card.append(top);
    card.append(
      node(
        "h3",
        q.title || `Listening Part ${state.part} · Bài ${state.index + 1}`,
      ),
    );
    if (q.stem) card.append(node("p", q.stem, "stem"));
    const audioList = node("div", null, "audio-list");
    const recordings = data.media.filter(
      (m) => String(m.question_id ?? m.question_source_id) === String(q.id),
    );
    if (!recordings.length)
      audioList.append(
        node(
          "p",
          "Không có tệp âm thanh trong manifest cho bài này.",
          "audio-error",
        ),
      );
    recordings.forEach((recording, i) => {
      const row = node("div", null, "audio-row");
      const label = recording.speaker
        ? `Speaker ${recording.speaker}`
        : recordings.length > 1
          ? `Bản ghi ${i + 1}`
          : "Bản ghi";
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.preload = "none";
      audio.src = audioPath(recording.file, data.root);
      audio.setAttribute("aria-label", label);
      const error = node(
        "span",
        "Không thể tải âm thanh từ bản sao lưu.",
        "audio-error",
      );
      error.hidden = true;
      audio.addEventListener("error", () => {
        error.hidden = false;
      });
      row.append(node("strong", label), audio, error);
      audioList.append(row);
    });
    card.append(audioList);
    if (!groups.length)
      card.append(
        node(
          "p",
          "Nguồn không có câu hỏi hoặc lựa chọn cho bài này.",
          "message",
        ),
      );
    const selected = state.selections.get(key) || {};
    groups.forEach((group, groupIndex) => {
      const fieldset = node("fieldset", null, "question-group");
      fieldset.append(
        node(
          "legend",
          state.part === 1
            ? "Chọn một đáp án"
            : `${groupIndex + 1}. ${group.question || "Câu hỏi không có nội dung"}`,
        ),
      );
      if (!group.choices.length)
        fieldset.append(node("p", "Nguồn không có lựa chọn cho câu hỏi này."));
      group.choices.forEach((choice, choiceIndex) => {
        const label = node("label", null, "choice"),
          input = document.createElement("input");
        input.type = "radio";
        input.name = `group-${groupIndex}`;
        input.value = String(choiceIndex);
        input.checked = selected[groupIndex] === String(choiceIndex);
        input.addEventListener("change", () => {
          selected[groupIndex] = input.value;
          state.selections.set(key, selected);
          state.checked.delete(key);
          clearAnswerMarks(card);
          const result = card.querySelector(".results");
          if (result) result.remove();
        });
        label.append(input, node("span", String(choice)));
        fieldset.append(label);
      });
      card.append(fieldset);
    });
    if (state.checked.has(key))
      appendResults(card, q, groups, selected, data.keys.get(String(q.id)));
    const actions = node("div", null, "exercise-actions"),
      prev = node("button", "← Bài trước"),
      check = node("button", "Kiểm tra đáp án", "check"),
      next = node("button", "Bài tiếp →", "next");
    prev.type = check.type = next.type = "button";
    prev.disabled = state.index === 0;
    next.disabled = state.index === data.questions.length - 1;
    prev.addEventListener("click", () => {
      state.index--;
      render();
    });
    next.addEventListener("click", () => {
      state.index++;
      render();
    });
    check.addEventListener("click", () => {
      state.checked.add(key);
      const existing = card.querySelector(".results");
      if (existing) existing.remove();
      appendResults(card, q, groups, selected, data.keys.get(String(q.id)));
    });
    actions.append(prev, check, next);
    card.append(actions);
    exercise.append(card);
  }
  function clearAnswerMarks(card) {
    card.querySelectorAll(".choice").forEach((label) => {
      label.classList.remove("answer-correct", "answer-incorrect");
      label.querySelector(".answer-icon")?.remove();
    });
  }
  function markAnswers(card, groups, selected, answerKey) {
    clearAnswerMarks(card);
    const answers =
      state.part === 1
        ? [answerKey?.correct_answer]
        : answerKey?.correct_answers;
    if (!Array.isArray(answers)) return;
    card.querySelectorAll(".question-group").forEach((group, i) => {
      const value = answers[i];
      if (
        value == null ||
        !/^\d+$/.test(String(value)) ||
        Number(value) >= groups[i].choices.length
      )
        return;
      group.querySelectorAll(".choice").forEach((label, index) => {
        const correct = index === Number(value);
        const wrong = selected[i] === String(index) && !correct;
        if (!correct && !wrong) return;
        label.classList.add(correct ? "answer-correct" : "answer-incorrect");
        const icon = node("span", correct ? "✓" : "✕", "answer-icon");
        icon.setAttribute(
          "aria-label",
          correct ? "Đáp án theo nguồn" : "Bạn đã chọn sai theo đáp án nguồn",
        );
        label.append(icon);
      });
    });
  }
  function appendResults(card, q, groups, selected, answerKey) {
    markAnswers(card, groups, selected, answerKey);
    const result = node("div", null, "results");
    result.setAttribute("role", "status");
    result.append(node("strong", "Đáp án do nguồn cung cấp"));
    result.append(
      node(
        "p",
        "Đây là đáp án từ nguồn, chưa được xác minh độc lập bằng cách nghe.",
      ),
    );
    const raw =
      state.part === 1
        ? [answerKey?.correct_answer]
        : answerKey?.correct_answers;
    const answers = Array.isArray(raw) ? raw : [];
    const list = node("ul");
    groups.forEach((group, i) => {
      const value = answers[i];
      const valid =
        value !== null &&
        value !== undefined &&
        /^\d+$/.test(String(value)) &&
        Number(value) < group.choices.length;
      const answer = valid
        ? group.choices[Number(value)]
        : "Nguồn không có đáp án hợp lệ";
      const item = node("li");
      item.append(
        node(
          "span",
          (state.part === 1 ? "Câu hỏi" : group.question) + ": " + answer,
        ),
      );
      if (valid) {
        const missing = selected[i] === undefined;
        const correct = selected[i] === String(value);
        const badge = node(
          "div",
          missing ? "Chưa chọn" : correct ? "Đúng" : "Sai",
          "answer-badge " +
            (missing ? "unanswered" : correct ? "correct" : "incorrect"),
        );
        badge.setAttribute(
          "aria-label",
          missing
            ? "Chưa chọn đáp án"
            : correct
              ? "Đúng theo đáp án nguồn"
              : "Sai theo đáp án nguồn",
        );
        item.append(badge);
      }
      list.append(item);
    });
    result.append(list);
    const explanation = htmlText(answerKey?.explanation);
    if (explanation) {
      const wrap = node("div", null, "explanation");
      wrap.append(
        node("strong", "Lời giải từ nguồn"),
        sourceContent(answerKey.explanation),
      );
      result.append(wrap);
    } else
      result.append(
        node("p", "Phản hồi kiểm tra từ nguồn không có lời giải cho bài này."),
      );
    if (state.part === 2 && Array.isArray(q.metadata?.descriptions)) {
      const descriptions = q.metadata.descriptions.map(htmlText);
      if (descriptions.some(Boolean)) {
        const details = node("details", null, "explanation");
        details.append(node("summary", "Mô tả người nói từ nguồn"));
        details.append(
          node(
            "p",
            "Mô tả do nguồn cung cấp; chưa được đối chiếu độc lập với âm thanh.",
          ),
        );
        descriptions.forEach((description, i) => {
          if (description)
            details.append(
              node("strong", q.metadata.items?.[i] || `Người nói ${i + 1}`),
              sourceContent(q.metadata.descriptions[i]),
            );
        });
        result.append(details);
      }
    }
    const actions = card.querySelector(".exercise-actions");
    if (actions) card.insertBefore(result, actions);
    else card.append(result);
  }
  select.addEventListener("change", () => {
    state.index = Number(select.value);
    render();
  });
  partButtons();
  openPart(1);
})();
