(() => {
  "use strict";
  const $ = (s) => document.querySelector(s),
    select = $("#guide-select"),
    output = $("#exercise"),
    status = $("#message");
  let catalog,
    seq = 0;
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text != null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  async function get(path) {
    const r = await fetch(path);
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    return r;
  }
  function local(path) {
    return "../" + path;
  }
  async function video(container, media) {
    const box = el("div", null, "guide-media");
    box.append(el("strong", media.title));
    box.append(el("p", "Video được mở trên Google Drive. Quyền truy cập phụ thuộc vào liên kết gốc."));
    box.append(external(media.source, "Mở video trên Google Drive (liên kết ngoài)"));
    container.append(box);
  }
  async function transcript(container, entry) {
    const box = el("details", null, "guide-transcript");
    box.append(
      el("summary", "Bản chép lời từ nguồn"),
      el(
        "p",
        "Bản chép lời chưa được đối chiếu độc lập với video. Video và âm thanh YouTube không được lưu tại máy.",
      ),
    );
    container.append(box);
    try {
      const data = await (await get(local(entry.file))).json();
      (data.segments || []).forEach((s) => box.append(el("p", s)));
    } catch {
      box.append(el("p", "Không tải được bản chép lời đã lưu."));
    }
  }
  function external(href, text) {
    const a = el("a", text || href);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }
  async function pdfLink(parent, pdf, label) {
    const wrap = el("span", "Đang kiểm tra PDF đã lưu…");
    parent.append(wrap);
    try {
      const r = await fetch(local(pdf.file), { method: "HEAD" });
      if (!r.ok) throw Error();
      const a = el("a", `${label} (PDF đã lưu)`);
      a.href = local(pdf.file);
      a.target = "_blank";
      a.rel = "noopener";
      wrap.replaceChildren(a);
    } catch {
      wrap.textContent = "Không tìm thấy PDF đã lưu trong bản sao lưu.";
    }
  }
  function renderNode(source, parent, article) {
    for (const child of source.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        parent.append(document.createTextNode(child.textContent));
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.tagName.toLowerCase();
      if (
        [
          "script",
          "style",
          "iframe",
          "object",
          "embed",
          "form",
          "video",
          "audio",
          "link",
        ].includes(tag)
      )
        continue;
      if (tag === "img") {
        const imageEntry = article.links.find(
          (x) => x.kind === "embedded-image",
        );
        if (imageEntry) {
          const img = document.createElement("img");
          img.src = local(imageEntry.file);
          img.alt =
            child.getAttribute("alt") || "Ảnh minh họa từ bài hướng dẫn";
          img.loading = "lazy";
          img.onerror = () => {
            img.replaceWith(
              el("p", "Không tải được ảnh đã lưu.", "media-status"),
            );
          };
          parent.append(img);
        } else
          parent.append(
            el("p", "Ảnh nguồn chưa có trong bản sao lưu.", "media-status"),
          );
        continue;
      }
      if (tag === "a") {
        const href = child.getAttribute("href") || "",
          label = child.textContent.trim() || href,
          media = catalog.linked_media.find((x) => href.includes(x.id)),
          pdf = catalog.external_resources.find(
            (x) => x.file && x.source === href,
          ),
          youtube = catalog.youtube_transcripts.find((x) => {
            try {
              return (
                new URL(x.source).searchParams.get("v") ===
                  new URL(href).searchParams.get("v") &&
                new URL(href).hostname.includes("youtube.com")
              );
            } catch {
              return false;
            }
          });
        if (media) {
          video(parent, media);
          continue;
        }
        if (pdf) {
          pdfLink(parent, pdf, label);
          continue;
        }
        if (/^https?:\/\//i.test(href)) {
          parent.append(external(href, `${label} (liên kết ngoài)`));
          if (youtube) transcript(parent, youtube);
          continue;
        }
        renderNode(child, parent, article);
        continue;
      }
      const safe = [
        "p",
        "div",
        "span",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "s",
        "ul",
        "ol",
        "li",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "blockquote",
        "br",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "hr",
      ].includes(tag)
        ? tag
        : "span";
      const node = document.createElement(safe);
      renderNode(child, node, article);
      parent.append(node);
    }
  }
  async function open(slug) {
    const article = catalog.articles.find((x) => x.slug === slug);
    if (!article) return;
    const token = ++seq;
    status.hidden = false;
    status.textContent = "Đang tải bài hướng dẫn…";
    output.hidden = true;
    try {
      const html = await (await get(local(article.html.path))).text();
      if (token !== seq) return;
      const safeHtml = html.replace(/<img\b[^>]*>/gi, "<img>");
      const doc = new DOMParser().parseFromString(safeHtml, "text/html");
      const body = doc.querySelector(".p-5");
      if (!body) throw Error("Không tìm thấy nội dung bài viết trong bản lưu");
      const card = el("article", null, "exercise-card guide-article");
      card.append(
        el("p", `BÀI ${article.order} · ${article.slug}`, "eyebrow"),
        el("h3", article.title),
        el(
          "p",
          `Lưu ngày ${article.captured} · Nguồn: ${article.source}`,
          "guide-source",
        ),
      );
      const content = el("div", null, "guide-content");
      renderNode(body, content, article);
      card.append(content);
      output.replaceChildren(card);
      output.hidden = false;
      status.hidden = true;
    } catch (e) {
      if (token === seq)
        status.textContent = `Không tải được bài hướng dẫn: ${e.message}`;
    }
  }
  select.addEventListener("change", () => open(select.value));
  (async () => {
    try {
      catalog = await (await get("../data/instructions/catalog.json")).json();
      if (!Array.isArray(catalog.articles)) throw Error("Catalog không hợp lệ");
      catalog.articles.forEach((a) => {
        const option = el("option", `${a.order}. ${a.title}`);
        option.value = a.slug;
        select.append(option);
      });
      select.disabled = false;
      if (catalog.articles.length) await open(select.value);
      else status.textContent = "Chưa có bài hướng dẫn.";
    } catch (e) {
      status.textContent = `Không tải được danh mục hướng dẫn: ${e.message}`;
    }
  })();
})();
