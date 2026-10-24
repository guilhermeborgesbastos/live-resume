/*
 * Assistant UI strings used from code (live-region announcements, aria labels). Strings that
 * appear in templates use i18n attributes; both end up in src/locales/messages.*.xlf.
 */
export const ASSISTANT_COPY = {
  fallback: $localize`:assistant@@assistant.fallback:I can’t answer this question using the information available in my CV. Please contact me directly so I can help.`,
  unavailable: $localize`:assistant@@assistant.unavailable:The CV information could not be loaded. Please try again or contact me directly.`,
  openPanel: $localize`:assistant@@assistant.launcher.label:Ask about my CV`,
  closePanel: $localize`:assistant@@assistant.panel.close:Close the CV assistant`,
  expandPanel: $localize`:assistant@@assistant.panel.expand:Open the CV assistant in a full page`
};
