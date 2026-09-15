/* PBv3 lesson runtime v1. Compatibility contract: docs/development/runtime.md. */
(() => {
  "use strict";

  // Runs in the head before CSS and body painting; keep this script synchronous.
  const THEME_STORAGE_KEY = "pbv3-gold-standard-theme";
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "dark" || savedTheme === "light") {
      document.documentElement.dataset.theme = savedTheme;
      document.documentElement.dataset.savedTheme = "true";
    }
  } catch {}
  if (!document.documentElement.dataset.theme)
    document.documentElement.dataset.theme = matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches
      ? "dark"
      : "light";

  // All DOM-dependent work waits until the lesson markup is available.
  function initializePage() {
    const documentRoot = document.documentElement;
    const themeButton = document.querySelector(".theme-toggle");
    const systemThemeMedia = window.matchMedia(
      "(prefers-color-scheme: dark)",
    );
    let hasExplicitTheme = documentRoot.dataset.savedTheme === "true";
    function updateThemeButton() {
      const isDarkTheme = documentRoot.dataset.theme === "dark";
      themeButton.setAttribute(
        "aria-label",
        isDarkTheme ? "Включить светлую тему" : "Включить тёмную тему",
      );
      themeButton.title = themeButton.getAttribute("aria-label");
    }
    themeButton.addEventListener("click", () => {
      documentRoot.dataset.theme =
        documentRoot.dataset.theme === "dark" ? "light" : "dark";
      hasExplicitTheme = true;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, documentRoot.dataset.theme);
      } catch {
        /* file:// may deny storage */
      }
      updateThemeButton();
    });
    systemThemeMedia.addEventListener("change", (event) => {
      if (!hasExplicitTheme) {
        documentRoot.dataset.theme = event.matches ? "dark" : "light";
        updateThemeButton();
      }
    });
    updateThemeButton();

    const tableOfContents = document.querySelector(".table-of-contents");
    // Only direct sections belong in the sidebar, regardless of nested headings.
    const contentSections = [
      ...document.querySelectorAll("main > section[id]"),
    ];
    const navigationLinks = contentSections.map((section) => {
      const link = document.createElement("a");
      link.href = "#" + section.id;
      const label = document.createElement("span");
      label.className = "table-of-contents__label";
      label.textContent = section.querySelector(":scope > h2").textContent;
      link.title = label.textContent;
      link.append(label);
      tableOfContents.append(link);
      return link;
    });
    function updateNavigationOverflow() {
      navigationLinks.forEach((link) => {
        const label = link.querySelector(".table-of-contents__label");
        link.classList.toggle(
          "is-truncated",
          label.scrollWidth > label.clientWidth,
        );
      });
    }
    new ResizeObserver(updateNavigationOverflow).observe(tableOfContents);
    const sidebar = document.querySelector(".sidebar");
    const sidebarToggle = document.querySelector(".sidebar-toggle");
    const mainContent = document.querySelector("main");
    const sidebarBackdrop = document.querySelector(".sidebar-backdrop");
    const overlayNavigationMedia = matchMedia("(max-width: 1516px)");
    function syncNavigation() {
      const isOpen = document.body.classList.contains("is-sidebar-open");
      sidebarToggle.setAttribute("aria-expanded", String(isOpen));
      sidebarToggle.setAttribute(
        "aria-label",
        isOpen ? "Скрыть содержание" : "Показать содержание",
      );
      sidebarToggle.title = sidebarToggle.getAttribute("aria-label");
      sidebar.inert = !isOpen;
      sidebar.setAttribute("aria-hidden", String(!isOpen));
      mainContent.inert = isOpen && overlayNavigationMedia.matches;
      // Keep the page still while the sidebar overlays the material.
      document.body.style.overflow =
        isOpen && overlayNavigationMedia.matches ? "hidden" : "";
      updateNavigationOverflow();
    }
    function setSidebarOpen(isOpen) {
      document.body.classList.toggle("is-sidebar-open", isOpen);
      syncNavigation();
    }
    sidebarToggle.addEventListener("click", () =>
      setSidebarOpen(!document.body.classList.contains("is-sidebar-open")),
    );
    sidebarBackdrop.addEventListener("click", () => {
      setSidebarOpen(false);
      sidebarToggle.focus();
    });
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        document.body.classList.contains("is-sidebar-open")
      ) {
        setSidebarOpen(false);
        sidebarToggle.focus();
      }
      if (
        event.key === "Tab" &&
        overlayNavigationMedia.matches &&
        document.body.classList.contains("is-sidebar-open")
      ) {
        const focusableElements = [
          sidebarToggle,
          themeButton,
          ...navigationLinks,
        ];
        const firstFocusableElement = focusableElements[0],
          lastFocusableElement =
            focusableElements[focusableElements.length - 1];
        if (
          event.shiftKey &&
          document.activeElement === firstFocusableElement
        ) {
          event.preventDefault();
          lastFocusableElement.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === lastFocusableElement
        ) {
          event.preventDefault();
          firstFocusableElement.focus();
        }
      }
    });
    tableOfContents.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;
      if (overlayNavigationMedia.matches) {
        setSidebarOpen(false);
        const target = document.getElementById(link.hash.slice(1));
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    });
    document
      .querySelector(".skip-link")
      .addEventListener("click", () => setSidebarOpen(false));
    overlayNavigationMedia.addEventListener("change", syncNavigation);
    setSidebarOpen(!overlayNavigationMedia.matches);
    let isProgressUpdateScheduled = false;
    function updateReadingProgress() {
      isProgressUpdateScheduled = false;
      const height = documentRoot.scrollHeight - documentRoot.clientHeight;
      const ratio =
        height > 0 ? Math.min(1, Math.max(0, window.scrollY / height)) : 0;
      document.querySelector(".reading-progress").style.transform =
        "scaleX(" + ratio + ")";
      let activeSectionIndex = 0;
      const activeSectionThreshold =
        document.querySelector(".page-header").getBoundingClientRect()
          .bottom + 42;
      navigationLinks.forEach((link, index) => {
        if (
          document
            .getElementById(link.hash.slice(1))
            .getBoundingClientRect().top <= activeSectionThreshold
        )
          activeSectionIndex = index;
      });
      if (ratio >= 0.995) activeSectionIndex = contentSections.length - 1;
      navigationLinks.forEach((link, index) => {
        if (index === activeSectionIndex)
          link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
      updateNavigationOverflow();
    }
    function scheduleReadingProgress() {
      if (!isProgressUpdateScheduled) {
        isProgressUpdateScheduled = true;
        requestAnimationFrame(updateReadingProgress);
      }
    }
    window.addEventListener("scroll", scheduleReadingProgress, {
      passive: true,
    });
    window.addEventListener("resize", scheduleReadingProgress);
    updateReadingProgress();
    new ResizeObserver(scheduleReadingProgress).observe(mainContent);

    async function copyCode(code, copyButton) {
      let wasCopied = false;
      try {
        await navigator.clipboard.writeText(code.textContent);
        wasCopied = true;
      } catch {
        const clipboardBuffer = document.createElement("textarea");
        clipboardBuffer.value = code.textContent;
        clipboardBuffer.style.cssText = "position:fixed;left:-9999px;top:0";
        document.body.append(clipboardBuffer);
        clipboardBuffer.select();
        try {
          wasCopied = document.execCommand("copy");
        } catch {
          /* use manual selection below */
        }
        clipboardBuffer.remove();
        copyButton.focus({ preventScroll: true });
      }
      if (!wasCopied) {
        const range = document.createRange();
        range.selectNodeContents(code);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
      document.getElementById("copy-status").textContent = wasCopied
        ? "Код скопирован."
        : "Код выделен. Нажмите Ctrl+C или выберите «Копировать» в меню браузера.";
      return wasCopied;
    }

    const copyTooltip = document.createElement("div");
    copyTooltip.className = "copy-tooltip";
    copyTooltip.hidden = true;
    copyTooltip.setAttribute("aria-hidden", "true");
    document.body.append(copyTooltip);
    let tooltipHideTimeoutId;
    let copyRequestId = 0;
    function hideCopyTooltip() {
      copyRequestId++;
      clearTimeout(tooltipHideTimeoutId);
      copyTooltip.hidden = true;
    }
    function showCopyTooltip(code, text) {
      copyTooltip.textContent = text;
      copyTooltip.hidden = false;
      const codeBounds = code.getBoundingClientRect();
      const width = copyTooltip.offsetWidth;
      const height = copyTooltip.offsetHeight;
      const center = codeBounds.left + codeBounds.width / 2;
      const left = Math.max(
        8,
        Math.min(center - width / 2, documentRoot.clientWidth - width - 8),
      );
      const above = codeBounds.top - height - 8;
      const placeBelowCode =
        above <
        document.querySelector(".page-header").getBoundingClientRect()
          .bottom +
          8;
      copyTooltip.dataset.side = placeBelowCode ? "below" : "above";
      copyTooltip.style.left = left + "px";
      copyTooltip.style.top =
        Math.max(
          8,
          Math.min(
            placeBelowCode ? codeBounds.bottom + 8 : above,
            window.innerHeight - height - 8,
          ),
        ) + "px";
      copyTooltip.style.setProperty(
        "--tooltip-arrow-offset",
        Math.max(10, Math.min(center - left, width - 10)) + "px",
      );
      tooltipHideTimeoutId = setTimeout(hideCopyTooltip, 1800);
    }
    document.querySelectorAll("code").forEach((code) => {
      if (code.closest("pre, label, button")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inline-code-copy";
      button.setAttribute("aria-label", "Скопировать: " + code.textContent);
      code.replaceWith(button);
      button.append(code);
      button.addEventListener("click", async () => {
        hideCopyTooltip();
        const currentCopyRequestId = copyRequestId;
        const wasCopied = await copyCode(code, button);
        if (currentCopyRequestId === copyRequestId)
          showCopyTooltip(
            code,
            wasCopied ? "Скопировано" : "Нажмите Ctrl+C",
          );
      });
    });
    window.addEventListener("scroll", hideCopyTooltip, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", hideCopyTooltip);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideCopyTooltip();
    });
    document
      .querySelectorAll(".code-example__copy-button")
      .forEach((button) => {
        let resetLabelTimeoutId;
        button.addEventListener("click", async () => {
          const code = button
            .closest(".code-example")
            .querySelector("pre code");
          const wasCopied = await copyCode(code, button);
          button.textContent = wasCopied ? "Скопировано" : "Нажмите Ctrl+C";
          clearTimeout(resetLabelTimeoutId);
          resetLabelTimeoutId = setTimeout(() => {
            button.textContent = "Копировать";
          }, 2500);
        });
      });
    initializeQuizzes();
  }

  function initializeQuizzes() {
    // Even-odd paths cut transparent check/cross shapes out of the filled circles.
    const circlePath = "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20Z";
    const answerIcons = {
      "correct-selected":
        '<path fill="currentColor" fill-rule="evenodd" d="' +
        circlePath +
        ' M6 12l2-2 3 3 5-6 2 2-7 8Z"/>',
      "correct-missed":
        '<circle cx="12" cy="12" r="10"/><path d="M12 7v10M7 12h10"/>',
      "incorrect-selected":
        '<path fill="currentColor" fill-rule="evenodd" d="' +
        circlePath +
        ' M7 9l2-2 3 3 3-3 2 2-3 3 3 3-2 2-3-3-3 3-2-2 3-3Z"/>',
      "incorrect-skipped":
        '<circle cx="12" cy="12" r="10"/><path d="M7 12h10"/>',
    };
    const answerStateLabels = {
      "correct-selected": "Верный вариант выбран. ",
      "correct-missed": "Верный вариант пропущен. ",
      "incorrect-selected": "Неверный вариант выбран. ",
      "incorrect-skipped": "Неверный вариант не выбран. ",
    };
    function shuffleOptions(container) {
      const options = [...container.children];
      for (let index = options.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [options[index], options[randomIndex]] = [
          options[randomIndex],
          options[index],
        ];
      }
      container.append(...options);
    }
    document.querySelectorAll('form.quiz[data-quiz="single"], form.quiz[data-quiz="multiple"], form.quiz[data-quiz="text"]').forEach((form) => {
      const button = form.querySelector(".quiz__submit-button");
      const summary = form.querySelector(".quiz__summary");
      const isMultipleChoice = ["single", "multiple"].includes(form.dataset.quiz);
      function resetQuiz() {
        form.reset();
        delete form.dataset.checked;
        delete form.dataset.complete;
        form.querySelectorAll("input").forEach((input) => {
          input.disabled = false;
        });
        form.querySelectorAll(".quiz__feedback").forEach((feedback) => {
          feedback.setAttribute("aria-hidden", "true");
          delete feedback.dataset.correct;
          if (!isMultipleChoice) feedback.querySelector("p").textContent = "";
        });
        form
          .querySelectorAll(".quiz-option__icon, .quiz-option__state-label")
          .forEach((element) => {
            element.replaceChildren();
          });
        summary.textContent = "";
        button.textContent = "Ответить";
        if (isMultipleChoice)
          shuffleOptions(form.querySelector(".quiz__options"));
        else
          form
            .querySelector(".quiz__input")
            .removeAttribute("aria-invalid");
      }
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (form.dataset.complete === "true") {
          resetQuiz();
          if (isMultipleChoice) form.querySelector("input").focus();
          else form.querySelector(".quiz__input").focus();
          return;
        }
        let isComplete = isMultipleChoice;
        if (isMultipleChoice) {
          let areAllAnswersCorrect = true;
          form.querySelectorAll(".quiz-option").forEach((option) => {
            const input = option.querySelector("input");
            const isCorrect = option.dataset.correct === "true";
            const answerState = isCorrect
              ? input.checked
                ? "correct-selected"
                : "correct-missed"
              : input.checked
                ? "incorrect-selected"
                : "incorrect-skipped";
            if (input.checked !== isCorrect) areAllAnswersCorrect = false;
            option.querySelector(".quiz-option__icon").innerHTML =
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" data-state="' +
              answerState +
              '">' +
              answerIcons[answerState] +
              "</svg>";
            // Filled paths need no stroke, keeping the cut-out shapes crisp.
            option
              .querySelector("svg path[fill]")
              ?.setAttribute("stroke", "none");
            option.querySelector(".quiz-option__state-label").textContent =
              answerStateLabels[answerState];
          });
          summary.textContent = areAllAnswersCorrect
            ? "Верно. Вы выбрали все верные варианты."
            : form.querySelector(".quiz__feedback")
              ? "Есть ошибки. Под каждым вариантом появилось пояснение."
              : "Есть ошибки. Проверьте отмеченные варианты.";
        } else {
          const input = form.querySelector(".quiz__input");
          // Deliberately no trim(), case folding, or numeric conversion.
          const isCorrect = input.value === form.dataset.answer;
          isComplete = isCorrect;
          const feedback = form.querySelector(".quiz__feedback");
          const message = isCorrect ? form.dataset.success : form.dataset.hint;
          feedback.dataset.correct = String(isCorrect);
          // Feedback belongs to this question; display it as plain text.
          feedback.querySelector("p").textContent = message;
          input.setAttribute("aria-invalid", String(!isCorrect));
          summary.textContent = feedback.textContent;
        }
        form.querySelectorAll("input").forEach((input) => {
          input.disabled = isComplete;
        });
        form.querySelectorAll(".quiz__feedback").forEach((feedback) => {
          feedback.setAttribute("aria-hidden", "false");
        });
        form.dataset.checked = "true";
        form.dataset.complete = String(isComplete);
        button.textContent = isComplete ? "Сбросить" : "Ответить";
        const focusTarget = isComplete
          ? button
          : form.querySelector(".quiz__input");
        focusTarget.focus({ preventScroll: true });
      });
      resetQuiz();
      // Returning through the back/forward cache starts a fresh attempt too.
      window.addEventListener("pageshow", (event) => {
        if (event.persisted) resetQuiz();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializePage, { once: true });
  } else {
    initializePage();
  }
})();
