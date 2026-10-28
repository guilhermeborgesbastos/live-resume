import { Params } from "@angular/router";
import { CitationTarget } from "../models/assistant.models";

/** Query parameter names the resume sections read to reveal a cited record. */
export const EXPERIENCE_QUERY_PARAM = "experienceId";
export const POST_QUERY_PARAM = "post";

export interface InternalLink {
  readonly commands: readonly string[];
  readonly fragment: string;
  readonly queryParams: Params | null;
}

/**
 * Router link to the cited record on the resume (relative to the locale's base href), or null
 * for a note, which the page doesn't show. Only generated record identifiers go into the URL,
 * never question or answer text.
 */
export function citationLink(target: CitationTarget): InternalLink | null {
  switch (target.section) {
    case "about":
      return { commands: ["/"], fragment: "about", queryParams: null };
    case "experience":
      return { commands: ["/"], fragment: "experience", queryParams: { [EXPERIENCE_QUERY_PARAM]: target.experienceId } };
    case "posts":
      return { commands: ["/"], fragment: "posts", queryParams: { [POST_QUERY_PARAM]: target.postUrl } };
    case "notes":
      return null;
  }
}

export const CONTACT_LINK: InternalLink = { commands: ["/"], fragment: "contact", queryParams: null };
