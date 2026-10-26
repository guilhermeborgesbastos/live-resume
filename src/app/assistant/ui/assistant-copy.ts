/*
 * Assistant UI strings used from code (live-region announcements, aria labels). Strings that
 * appear in templates use i18n attributes; both end up in src/locales/messages.*.xlf.
 */
export const ASSISTANT_COPY = {
  fallback: $localize`:assistant@@assistant.fallback:I can’t answer this question using the information available in my CV. Please contact me directly so I can help.`,
  unavailable: $localize`:assistant@@assistant.unavailable:The CV information could not be loaded. Please try again or contact me directly.`,
  clarify: {
    typo: $localize`:assistant@@assistant.clarify.typo:I couldn’t find that name in my CV exactly. Did you mean one of these questions?`,
    ambiguous: $localize`:assistant@@assistant.clarify.ambiguous:That could refer to more than one thing in my CV. Which question did you mean?`
  },
  openPanel: $localize`:assistant@@assistant.launcher.label:Ask my AI Assistant`,
  closePanel: $localize`:assistant@@assistant.panel.close:Close the AI assistant`,
  expandPanel: $localize`:assistant@@assistant.panel.expand:Open the AI assistant in a full page`
};
