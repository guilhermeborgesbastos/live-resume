import { Pipe } from '@angular/core';

@Pipe({
  name: 'ellipsis'
})
export class EllipsisPipe {
  transform(val: string, args: number = 60) {
    if (val.length > args) {
      return val.substring(0, args) + '...';
    }
    return val;
  }
}