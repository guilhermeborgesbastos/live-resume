import { DatePipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
import { LOCALE_ID, Inject } from '@angular/core';

@Pipe({
  name: 'localizedDate',
  pure: false
})
export class LocalizedDatePipe implements PipeTransform {

  constructor(@Inject(LOCALE_ID) public locale: string) {}

  transform(value: any, pattern: string = 'mediumDate'): any {
    const datePipe: DatePipe = new DatePipe(this.locale);
    return datePipe.transform(value, pattern);
  }
}