/*
 * In order to make the Safari and IE understand the date format to be used in the 'date' pipe it is 
 * necessary to replace '-' by '/'.
*/
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'safariDateFormatter' })
export class SafariDateFormatterPipe implements PipeTransform {
    transform(value: any) {
        if (value) {
            return value.replace(/-/g,'/');
        }
        return value;
    }
}