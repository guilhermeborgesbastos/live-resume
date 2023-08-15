import { Pipe, PipeTransform } from '@angular/core';
import { tags } from 'src/assets/tags/tags';

@Pipe({name: 'translate'})
export class TranslatePipe implements PipeTransform {

    transform( tag: string): string {
        return tags[tag as keyof typeof tags];
    }
}

// {{ '' | translate }}