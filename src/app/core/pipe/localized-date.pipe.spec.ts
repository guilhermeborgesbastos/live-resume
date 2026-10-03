import { registerLocaleData } from "@angular/common";
import localePt from "@angular/common/locales/pt";
import { LOCALE_ID } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { LocalizedDatePipe } from "./localized-date.pipe";

describe("LocalizedDatePipe", () => {

  function createPipe(locale: string): LocalizedDatePipe {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: locale }] });
    return TestBed.runInInjectionContext(() => new LocalizedDatePipe());
  }

  beforeAll(() => registerLocaleData(localePt, "pt"));

  it("formats dates with the English locale", () => {
    const pipe = createPipe("en");
    expect(pipe.transform("05/01/2020", "MMM yyyy")).toBe("May 2020");
  });

  it("formats dates with the Portuguese locale", () => {
    const pipe = createPipe("pt");
    expect(pipe.transform("05/01/2020", "MMM yyyy")).toBe("mai. 2020");
  });

  it("describes a missing end date as ongoing in each language", () => {
    expect(createPipe("en").transform(undefined, "MMM yyyy")).toBe("Currently");
    TestBed.resetTestingModule();
    expect(createPipe("pt").transform(undefined, "MMM yyyy")).toBe("Atualmente");
  });
});
