import { DatePipe } from "@angular/common";
import { Pipe, PipeTransform, inject } from "@angular/core";
import { LOCALE_ID } from "@angular/core";

@Pipe({
    name: "localizedDate",
    pure: false
})
export class LocalizedDatePipe implements PipeTransform {
  locale = inject(LOCALE_ID);


  transform(value: any, pattern: string = "mediumDate"): any {
    const datePipe: DatePipe = new DatePipe(this.locale);
    // For now, the translation will be manual, further on, the i18n service will be injected to provide such capability...
    return datePipe.transform(value, pattern) || (this.locale === "en" ? "Currently" : "Atualmente");
  }
}