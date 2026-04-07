const elements = {
  folderPicker: document.getElementById("folderPicker"),
  hero: document.getElementById("hero"),
  heroMediaLayer: document.getElementById("heroMediaLayer"),
  storyTitle: document.getElementById("storyTitle"),
  storyDescription: document.getElementById("storyDescription"),
  libraryState: document.getElementById("libraryState"),
  librarySummary: document.getElementById("librarySummary"),
  storyProgressLabel: document.getElementById("storyProgressLabel"),
  galleryGrid: document.getElementById("galleryGrid"),
  readerFlow: document.getElementById("readerFlow"),
  emptyState: document.getElementById("emptyState"),
  gridViewButton: document.getElementById("gridViewButton"),
  readerViewButton: document.getElementById("readerViewButton"),
  viewer: document.getElementById("viewer"),
  viewerFrame: document.getElementById("viewerFrame"),
  viewerMedia: document.getElementById("viewerMedia"),
  viewerTitle: document.getElementById("viewerTitle"),
  viewerDescription: document.getElementById("viewerDescription"),
  viewerStrip: document.getElementById("viewerStrip"),
  toggleFullscreen: document.getElementById("toggleFullscreen"),
  prevItem: document.getElementById("prevItem"),
  nextItem: document.getElementById("nextItem"),
  closeViewer: document.getElementById("closeViewer"),
  cardTemplate: document.getElementById("cardTemplate"),
  readerFrameTemplate: document.getElementById("readerFrameTemplate"),
  stripItemTemplate: document.getElementById("stripItemTemplate"),
};

const MEDIA_EXTENSIONS = {
  image: new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif"]),
  video: new Set(["mp4", "webm", "ogg", "mov", "m4v"]),
};

const STORY_META_NAMES = new Set(["story", "album", "index"]);
const HERO_MEDIA_NAMES = new Set(["cover", "background"]);

let objectUrls = [];
let galleryItems = [];
let activeIndex = -1;
let isZoomed = false;
let currentView = "grid";
let zoomLevel = 1;
let baseMediaSize = null;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartScrollLeft = 0;
let dragStartScrollTop = 0;
let isPseudoFullscreen = false;

elements.folderPicker.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []);
  resetObjectUrls();

  if (!files.length) {
    return;
  }

  const parsed = await buildLibrary(files);
  renderLibrary(parsed);
});

elements.gridViewButton.addEventListener("click", () => setView("grid"));
elements.readerViewButton.addEventListener("click", () => setView("reader"));
elements.closeViewer.addEventListener("click", closeViewer);
elements.toggleFullscreen.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", () => {
  syncFullscreenButton();
  refreshViewerLayout();
});

elements.viewer.addEventListener("click", (event) => {
  if (event.target !== elements.viewer) {
    return;
  }

  const bounds = elements.viewer.getBoundingClientRect();
  const clickedOutside =
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom;

  if (clickedOutside) {
    closeViewer();
  }
});

elements.prevItem.addEventListener("click", () => stepViewer(-1));
elements.nextItem.addEventListener("click", () => stepViewer(1));

elements.viewerMedia.addEventListener("click", (event) => {
  if (isDragging) {
    isDragging = false;
    return;
  }

  if (event.target !== elements.viewerMedia && !elements.viewerMedia.contains(event.target)) {
    return;
  }

  const anchor = getZoomAnchor(event);
  setZoom(isZoomed ? 1 : 1.6, anchor);
});

elements.viewerMedia.addEventListener(
  "wheel",
  (event) => {
    if (!elements.viewer.open) {
      return;
    }

    event.preventDefault();
    const anchor = getZoomAnchor(event);
    const delta = event.deltaY < 0 ? 0.12 : -0.12;
    const nextZoom = clampZoom(zoomLevel + delta);
    setZoom(nextZoom, anchor);
  },
  { passive: false }
);

elements.viewerMedia.addEventListener("mousedown", (event) => {
  if (!isZoomed || event.button !== 0) {
    return;
  }

  event.preventDefault();
  isDragging = false;
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  dragStartScrollLeft = elements.viewerMedia.scrollLeft;
  dragStartScrollTop = elements.viewerMedia.scrollTop;
  elements.viewerMedia.classList.add("is-dragging");

  const onMouseMove = (moveEvent) => {
    const deltaX = moveEvent.clientX - dragStartX;
    const deltaY = moveEvent.clientY - dragStartY;

    if (!isDragging && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
      isDragging = true;
    }

    elements.viewerMedia.scrollLeft = dragStartScrollLeft - deltaX;
    elements.viewerMedia.scrollTop = dragStartScrollTop - deltaY;
  };

  const onMouseUp = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    elements.viewerMedia.classList.remove("is-dragging");

    if (isDragging) {
      setTimeout(() => {
        isDragging = false;
      }, 0);
    }
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
});

document.addEventListener("keydown", (event) => {
  if (!elements.viewer.open) {
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    stepViewer(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    stepViewer(1);
  } else if (event.key === "Escape") {
    event.preventDefault();
    if (document.fullscreenElement === elements.viewerFrame) {
      document.exitFullscreen().catch(() => {});
    } else {
      closeViewer();
    }
  } else if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    if (!isZoomed) {
      elements.viewerMedia.click();
    }
  } else if (event.key === "-") {
    event.preventDefault();
    if (isZoomed) {
      elements.viewerMedia.click();
    }
  } else if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    toggleFullscreen();
  }
});

function resetObjectUrls() {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls = [];
  galleryItems = [];
}

async function buildLibrary(files) {
  const textEntries = new Map();
  let storyMeta = null;
  let heroMedia = null;
  const mediaItems = [];

  for (const file of files) {
    const extension = getExtension(file.name);
    const relativeBaseKey = getRelativeBaseKey(file);
    const relativeFileKey = getRelativeFileKey(file);
    const baseName = getBaseName(file.name).toLowerCase();

    if (extension === "txt") {
      const rawText = await file.text();
      const parsedText = parseTextFile(rawText, file.name);

      if (STORY_META_NAMES.has(baseName)) {
        storyMeta = parsedText;
      } else {
        textEntries.set(relativeBaseKey, parsedText);
        textEntries.set(relativeFileKey, parsedText);
      }
      continue;
    }

    const type = getMediaType(extension);
    if (!type) {
      continue;
    }

    const objectUrl = URL.createObjectURL(file);
    objectUrls.push(objectUrl);

    const item = {
      id: crypto.randomUUID(),
      name: getBaseName(file.name),
      filename: file.name,
      relativeBaseKey,
      relativeFileKey,
      type,
      src: objectUrl,
    };

    if (isHeroMediaCandidate(item) && !heroMedia) {
      heroMedia = item;
    } else {
      mediaItems.push(item);
    }
  }

  galleryItems = mediaItems
    .map((item) => {
      const text =
        textEntries.get(item.relativeFileKey) || textEntries.get(item.relativeBaseKey);
      return {
        ...item,
        title: text?.title || prettifyName(item.name),
        description:
          text?.description ||
          "Brak opisu dla tego kadru. Dodaj plik tekstowy o tej samej nazwie, aby pokazać nagłówek i opis sceny.",
        excerpt: makeExcerpt(text?.description),
        previewStart: text?.meta?.previewStart ?? 0,
        previewEnd: text?.meta?.previewEnd ?? null,
      };
    })
    .sort((a, b) => a.filename.localeCompare(b.filename, "pl", { numeric: true }));

  return { storyMeta, heroMedia, galleryItems };
}

function renderLibrary({ storyMeta, heroMedia, galleryItems }) {
  const total = galleryItems.length;
  const imageCount = galleryItems.filter((item) => item.type === "image").length;
  const videoCount = galleryItems.filter((item) => item.type === "video").length;

  elements.storyTitle.textContent = storyMeta?.title || "Moja komiksowa historia";
  elements.storyDescription.textContent =
    storyMeta?.description ||
    "Przeglądaj kadry jak planszę albo przełącz się na tryb czytania, aby oglądać historię jak sekwencję komiksowych scen.";
  elements.storyProgressLabel.textContent = total > 0 ? formatIndex(total - 1) : "00";
  elements.libraryState.textContent = total > 0 ? `${total} kadrów gotowych` : "Nie znaleziono kadrów";
  elements.librarySummary.textContent =
    total > 0
      ? `Wczytałem ${imageCount} obrazów i ${videoCount} plików wideo. Każdy kadr ma własny numer, a podgląd działa jak reader historii.`
      : "W katalogu nie znalazłem obsługiwanych obrazów ani wideo. Sprawdź pliki i spróbuj ponownie.";

  applyHeroBackground(heroMedia);

  if (elements.viewer.open) {
    closeViewer();
  }

  elements.galleryGrid.innerHTML = "";
  elements.readerFlow.innerHTML = "";
  elements.viewerStrip.innerHTML = "";
  elements.emptyState.classList.toggle("is-hidden", total > 0);

  galleryItems.forEach((item, index) => {
    elements.galleryGrid.appendChild(createGridCard(item, index));
    elements.readerFlow.appendChild(createReaderFrame(item, index));
    elements.viewerStrip.appendChild(createStripItem(item, index));
  });

  setView(currentView);
}

function createGridCard(item, index) {
  const fragment = elements.cardTemplate.content.cloneNode(true);
  const button = fragment.querySelector(".story-card__button");
  const mediaContainer = fragment.querySelector(".story-card__media");
  const title = fragment.querySelector(".story-card__title");
  const description = fragment.querySelector(".story-card__description");

  mediaContainer.appendChild(createMediaElement(item, true));
  title.textContent = item.title;
  description.textContent = item.excerpt;
  button.addEventListener("click", () => openViewer(index));

  return fragment;
}

function createReaderFrame(item, index) {
  const fragment = elements.readerFrameTemplate.content.cloneNode(true);
  const button = fragment.querySelector(".reader-frame__button");
  const itemNumber = fragment.querySelector(".reader-frame__index");
  const title = fragment.querySelector(".reader-frame__title");
  const media = fragment.querySelector(".reader-frame__media");
  const description = fragment.querySelector(".reader-frame__description");

  itemNumber.textContent = formatIndex(index);
  title.textContent = item.title;
  media.appendChild(createMediaElement(item, true));
  description.textContent = item.description;
  button.addEventListener("click", () => openViewer(index));

  return fragment;
}

function createStripItem(item, index) {
  const fragment = elements.stripItemTemplate.content.cloneNode(true);
  const button = fragment.querySelector(".strip-item");
  const media = fragment.querySelector(".strip-item__media");
  const label = fragment.querySelector(".strip-item__index");

  media.appendChild(createMediaElement(item, true));
  label.textContent = formatIndex(index);
  button.addEventListener("click", () => openViewer(index));

  return fragment;
}

function setView(view) {
  currentView = view;
  const isGrid = view === "grid";

  elements.galleryGrid.classList.toggle("is-hidden", !isGrid);
  elements.readerFlow.classList.toggle("is-visible", !isGrid);
  elements.gridViewButton.classList.toggle("is-active", isGrid);
  elements.readerViewButton.classList.toggle("is-active", !isGrid);
  elements.gridViewButton.setAttribute("aria-pressed", String(isGrid));
  elements.readerViewButton.setAttribute("aria-pressed", String(!isGrid));
}

function applyHeroBackground(heroMedia) {
  elements.heroMediaLayer.innerHTML = "";

  if (!heroMedia) {
    elements.hero.style.background =
      "radial-gradient(circle at top left, rgba(255,255,255,0.08), transparent 30%), linear-gradient(145deg, rgba(24,24,27,0.38), rgba(24,24,27,0.78)), linear-gradient(135deg, #90959d 0%, #5b6068 38%, #23252a 100%)";
    return;
  }

  if (heroMedia.type === "image") {
    elements.hero.style.background = `linear-gradient(145deg, rgba(24,24,27,0.34), rgba(24,24,27,0.76)), url("${heroMedia.src}") center/cover`;
    return;
  }

  elements.hero.style.background =
    "linear-gradient(145deg, rgba(24,24,27,0.4), rgba(24,24,27,0.8)), linear-gradient(135deg, #90959d 0%, #5b6068 38%, #23252a 100%)";

  const video = document.createElement("video");
  video.src = heroMedia.src;
  video.autoplay = true;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  elements.heroMediaLayer.appendChild(video);
}

function createMediaElement(item, muted = false) {
  if (item.type === "video") {
    const video = document.createElement("video");
    video.src = item.src;
    video.playsInline = true;
    video.preload = "metadata";
    video.controls = !muted;
    video.muted = muted;
    video.loop = muted;
    if (muted) {
      video.autoplay = true;
      applyVideoPreviewMetadata(video, item);
    }
    return video;
  }

  const image = document.createElement("img");
  image.src = item.src;
  image.alt = item.title;
  image.loading = "lazy";
  return image;
}

function stepViewer(direction) {
  if (!galleryItems.length) {
    return;
  }

  const nextIndex =
    direction < 0
      ? activeIndex <= 0
        ? galleryItems.length - 1
        : activeIndex - 1
      : activeIndex >= galleryItems.length - 1
        ? 0
        : activeIndex + 1;

  openViewer(nextIndex);
}

function openViewer(index) {
  const item = galleryItems[index];
  if (!item) {
    return;
  }

  activeIndex = index;
  zoomLevel = 1;
  isZoomed = false;
  baseMediaSize = null;
  elements.viewerMedia.innerHTML = "";
  elements.viewerMedia.classList.remove("is-zoomed");
  elements.viewerMedia.classList.remove("is-dragging");
  const mediaShell = document.createElement("div");
  mediaShell.className = "viewer__media-shell";
  const mediaElement = createMediaElement(item, false);
  mediaShell.appendChild(mediaElement);
  elements.viewerMedia.appendChild(mediaShell);
  elements.viewerTitle.textContent = item.title;
  elements.viewerDescription.textContent = item.description;
  syncViewerStrip();

  if (!elements.viewer.open) {
    elements.viewer.showModal();
  }

  prepareZoomableMedia(mediaElement);
  elements.viewerMedia.focus({ preventScroll: true });
}

function syncViewerStrip() {
  const items = Array.from(elements.viewerStrip.querySelectorAll(".strip-item"));
  items.forEach((item, index) => {
    item.classList.toggle("is-active", index === activeIndex);
  });

  const activeItem = items[activeIndex];
  if (activeItem) {
    activeItem.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }
}

function closeViewer() {
  if (document.fullscreenElement === elements.viewerFrame) {
    document.exitFullscreen().catch(() => {});
  }
  setPseudoFullscreen(false);

  if (elements.viewer.open) {
    elements.viewer.close();
  }

  elements.viewerMedia.innerHTML = "";
  elements.viewerMedia.classList.remove("is-zoomed");
  elements.viewerMedia.classList.remove("is-dragging");
  zoomLevel = 1;
  isZoomed = false;
  isDragging = false;
  baseMediaSize = null;
  activeIndex = -1;
  syncFullscreenButton();
}

function setZoom(value, anchor = null) {
  const mediaElement = elements.viewerMedia.querySelector("img, video");
  const mediaShell = elements.viewerMedia.querySelector(".viewer__media-shell");
  if (!mediaElement || !baseMediaSize) {
    return;
  }

  zoomLevel = clampZoom(value);
  isZoomed = zoomLevel > 1.01;
  elements.viewerMedia.classList.toggle("is-zoomed", isZoomed);
  applyMediaSize(mediaElement, mediaShell, zoomLevel);

  if (!anchor) {
    return;
  }

  requestAnimationFrame(() => {
    const nextMedia = elements.viewerMedia.querySelector("img, video");
    const nextShell = elements.viewerMedia.querySelector(".viewer__media-shell");
    if (!nextMedia || !nextShell) {
      return;
    }

    const mediaLeft = (nextShell.offsetWidth - nextMedia.offsetWidth) / 2;
    const mediaTop = (nextShell.offsetHeight - nextMedia.offsetHeight) / 2;
    const targetX = mediaLeft + anchor.ratioX * nextMedia.offsetWidth;
    const targetY = mediaTop + anchor.ratioY * nextMedia.offsetHeight;
    const nextLeft = targetX - anchor.offsetX;
    const nextTop = targetY - anchor.offsetY;

    elements.viewerMedia.scrollLeft = Math.max(0, nextLeft);
    elements.viewerMedia.scrollTop = Math.max(0, nextTop);
  });
}

function clampZoom(value) {
  return Math.min(3, Math.max(1, Number(value.toFixed(2))));
}

function getZoomAnchor(event) {
  const mediaElement = elements.viewerMedia.querySelector("img, video");
  const mediaShell = elements.viewerMedia.querySelector(".viewer__media-shell");
  if (!mediaElement || !baseMediaSize) {
    return null;
  }

  const containerRect = elements.viewerMedia.getBoundingClientRect();
  if (!containerRect.width || !containerRect.height || !mediaShell) {
    return null;
  }

  const offsetX = Math.min(containerRect.width, Math.max(0, event.clientX - containerRect.left));
  const offsetY = Math.min(containerRect.height, Math.max(0, event.clientY - containerRect.top));
  const contentX = elements.viewerMedia.scrollLeft + offsetX;
  const contentY = elements.viewerMedia.scrollTop + offsetY;
  const mediaLeft = (mediaShell.offsetWidth - mediaElement.offsetWidth) / 2;
  const mediaTop = (mediaShell.offsetHeight - mediaElement.offsetHeight) / 2;
  const relativeX = contentX - mediaLeft;
  const relativeY = contentY - mediaTop;
  const ratioX = mediaElement.offsetWidth ? relativeX / mediaElement.offsetWidth : 0.5;
  const ratioY = mediaElement.offsetHeight ? relativeY / mediaElement.offsetHeight : 0.5;

  return {
    offsetX,
    offsetY,
    ratioX: Math.min(1, Math.max(0, ratioX)),
    ratioY: Math.min(1, Math.max(0, ratioY)),
  };
}

function prepareZoomableMedia(mediaElement) {
  const finalize = () => {
    const mediaShell = elements.viewerMedia.querySelector(".viewer__media-shell");
    const intrinsicWidth =
      mediaElement.naturalWidth || mediaElement.videoWidth || mediaElement.clientWidth || 1;
    const intrinsicHeight =
      mediaElement.naturalHeight || mediaElement.videoHeight || mediaElement.clientHeight || 1;

    const bounds = getContainedSize(
      intrinsicWidth,
      intrinsicHeight,
      elements.viewerMedia.clientWidth,
      Math.min(elements.viewerMedia.clientHeight || 680, 680)
    );

    baseMediaSize = bounds;
    zoomLevel = 1;
    isZoomed = false;
    applyMediaSize(mediaElement, mediaShell, 1);
  };

  if (mediaElement.tagName === "IMG") {
    if (mediaElement.complete) {
      finalize();
    } else {
      mediaElement.addEventListener("load", finalize, { once: true });
    }
    return;
  }

  if (mediaElement.readyState >= 1) {
    finalize();
  } else {
    mediaElement.addEventListener("loadedmetadata", finalize, { once: true });
  }
}

function refreshViewerLayout() {
  if (!elements.viewer.open) {
    return;
  }

  const mediaElement = elements.viewerMedia.querySelector("img, video");
  if (!mediaElement) {
    return;
  }

  baseMediaSize = null;
  prepareZoomableMedia(mediaElement);
}

function applyMediaSize(mediaElement, mediaShell, scale) {
  if (!baseMediaSize || !mediaShell) {
    return;
  }

  const scaledWidth = Math.round(baseMediaSize.width * scale);
  const scaledHeight = Math.round(baseMediaSize.height * scale);
  const shellWidth = Math.max(elements.viewerMedia.clientWidth, scaledWidth);
  const shellHeight = Math.max(elements.viewerMedia.clientHeight, scaledHeight);

  mediaShell.style.width = `${shellWidth}px`;
  mediaShell.style.height = `${shellHeight}px`;
  mediaElement.style.width = `${scaledWidth}px`;
  mediaElement.style.height = `${scaledHeight}px`;
}

function getContainedSize(mediaWidth, mediaHeight, boxWidth, boxHeight) {
  const widthRatio = boxWidth / mediaWidth;
  const heightRatio = boxHeight / mediaHeight;
  const ratio = Math.min(widthRatio, heightRatio, 1);

  return {
    width: Math.max(1, Math.round(mediaWidth * ratio)),
    height: Math.max(1, Math.round(mediaHeight * ratio)),
  };
}

function parseTextFile(rawText, filename) {
  const normalized = rawText.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return {
      title: prettifyName(getTextTitleBaseName(filename)),
      description: "",
      meta: {},
    };
  }

  const { meta, bodyLines } = parseTextMetadata(normalized.split("\n"));
  const [firstLine, ...rest] = bodyLines;
  const fallbackTitle = prettifyName(getTextTitleBaseName(filename));

  return {
    title: firstLine?.trim() || fallbackTitle,
    description: rest.join("\n").trim(),
    meta,
  };
}

function parseTextMetadata(lines) {
  const meta = {};
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      break;
    }

    const match = line.match(/^@([a-zA-Z][\w-]*):\s*(.+)$/);
    if (!match) {
      break;
    }

    const [, rawKey, rawValue] = match;
    const key = rawKey.toLowerCase();
    const value = rawValue.trim();

    if (key === "previewstart") {
      const parsed = Number(value.replace(",", "."));
      if (Number.isFinite(parsed) && parsed >= 0) {
        meta.previewStart = parsed;
      }
    }

    if (key === "previewend") {
      const parsed = Number(value.replace(",", "."));
      if (Number.isFinite(parsed) && parsed >= 0) {
        meta.previewEnd = parsed;
      }
    }

    index += 1;
  }

  return {
    meta,
    bodyLines: lines.slice(index),
  };
}

function applyVideoPreviewMetadata(video, item) {
  const desiredStart = Number.isFinite(item.previewStart) ? Math.max(0, item.previewStart) : 0;
  const desiredEnd = Number.isFinite(item.previewEnd) ? Math.max(0, item.previewEnd) : null;

  const syncPreview = () => {
    const duration = Number.isFinite(video.duration) ? video.duration : null;
    const start = duration === null ? desiredStart : Math.min(desiredStart, Math.max(duration - 0.1, 0));
    const end =
      duration === null || desiredEnd === null ? desiredEnd : Math.min(desiredEnd, duration);

    if (start > 0 && Math.abs(video.currentTime - start) > 0.2) {
      video.currentTime = start;
    }

    if (end !== null && end > start) {
      video.loop = false;
      video.addEventListener("timeupdate", () => {
        if (video.currentTime >= end) {
          video.currentTime = start;
          const playPromise = video.play();
          if (playPromise?.catch) {
            playPromise.catch(() => {});
          }
        }
      });
      return;
    }

    video.loop = true;
  };

  if (video.readyState >= 1) {
    syncPreview();
  } else {
    video.addEventListener("loadedmetadata", syncPreview, { once: true });
  }
}

function getMediaType(extension) {
  if (MEDIA_EXTENSIONS.image.has(extension)) {
    return "image";
  }

  if (MEDIA_EXTENSIONS.video.has(extension)) {
    return "video";
  }

  return null;
}

function getExtension(filename) {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

function getBaseName(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

function getTextTitleBaseName(filename) {
  const withoutTxt = filename.replace(/\.txt$/i, "");
  const extension = getExtension(withoutTxt);

  if (MEDIA_EXTENSIONS.image.has(extension) || MEDIA_EXTENSIONS.video.has(extension)) {
    return getBaseName(withoutTxt);
  }

  return withoutTxt;
}

function isHeroMediaCandidate(item) {
  const normalizedName = item.name.toLowerCase();

  if (item.type === "image" && normalizedName.includes("hero")) {
    return true;
  }

  return HERO_MEDIA_NAMES.has(normalizedName);
}

function getRelativeBaseKey(file) {
  const relativePath = (file.webkitRelativePath || file.name).replace(/\\/g, "/");
  return relativePath.replace(/\.[^.]+$/, "").toLowerCase();
}

function getRelativeFileKey(file) {
  return (file.webkitRelativePath || file.name).replace(/\\/g, "/").toLowerCase();
}

function makeExcerpt(text = "") {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "Kliknij, aby otworzyć pełny kadr.";
  }

  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 117).trimEnd()}...`;
}

function prettifyName(name) {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatIndex(index) {
  return String(index + 1).padStart(2, "0");
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement === elements.viewerFrame) {
      await document.exitFullscreen();
    } else if (isPseudoFullscreen) {
      setPseudoFullscreen(false);
    } else {
      if (elements.viewerFrame.requestFullscreen) {
        await elements.viewerFrame.requestFullscreen();
      } else {
        setPseudoFullscreen(true);
      }
    }
  } catch {
    setPseudoFullscreen(!isPseudoFullscreen);
  } finally {
    syncFullscreenButton();
  }
}

function syncFullscreenButton() {
  const isFullscreen = document.fullscreenElement === elements.viewerFrame || isPseudoFullscreen;
  elements.toggleFullscreen.textContent = isFullscreen ? "Zamknij pełny ekran" : "Pełny ekran";
  elements.toggleFullscreen.setAttribute(
    "aria-label",
    isFullscreen ? "Zamknij pełny ekran" : "Pełny ekran"
  );
}

function setPseudoFullscreen(enabled) {
  isPseudoFullscreen = enabled;
  elements.viewer.classList.toggle("viewer--pseudo-fullscreen", enabled);
  elements.viewerFrame.classList.toggle("viewer__frame--pseudo-fullscreen", enabled);
  document.body.classList.toggle("body--viewer-fullscreen", enabled);
  requestAnimationFrame(() => {
    refreshViewerLayout();
  });
}
