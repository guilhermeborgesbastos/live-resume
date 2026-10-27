import { Injectable, inject, signal } from "@angular/core";
import { forkJoin, Subscription } from "rxjs";
import { DataService } from "../../core/data.service";
import { KnowledgeSnapshot } from "../models/assistant.models";
import { adaptKnowledge } from "./knowledge-adapter";

export type KnowledgeState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly snapshot: KnowledgeSnapshot }
  | { readonly status: "error" };

/**
 * Loads the approved JSON files once (through the existing DataService) and keeps the validated
 * snapshot for every assistant view. A failed request or invalid data never yields a partial
 * snapshot: the state becomes "error" until retry() loads all three files again.
 */
@Injectable({ providedIn: "root" })
export class AssistantKnowledgeService {
  private dataService = inject(DataService);

  private readonly _state = signal<KnowledgeState>({ status: "idle" });
  readonly state = this._state.asReadonly();

  private request?: Subscription;

  load(): void {
    const status = this._state().status;
    if (status === "loading" || status === "ready") {
      return;
    }
    this._state.set({ status: "loading" });
    this.request = forkJoin({
      about: this.dataService.getAbout(),
      experiences: this.dataService.getExperiences(),
      posts: this.dataService.getPosts()
    }).subscribe({
      next: raw => {
        try {
          this._state.set({ status: "ready", snapshot: adaptKnowledge(raw) });
        } catch (error) {
          console.warn("CV assistant data rejected:", error);
          this._state.set({ status: "error" });
        }
      },
      error: () => this._state.set({ status: "error" })
    });
  }

  retry(): void {
    if (this._state().status === "error") {
      this.request?.unsubscribe();
      this._state.set({ status: "idle" });
      this.load();
    }
  }
}
