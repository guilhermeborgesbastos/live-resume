import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: "ellipsis"
})
export class EllipsisPipe implements PipeTransform {
  transform(val: string, args: number = 60) {
    if (val.length > args) {
      return val.substring(0, args) + "...";
    }
    return val;
  }
}