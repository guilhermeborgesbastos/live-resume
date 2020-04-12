import { Component, NgZone, OnInit, HostListener, OnDestroy } from '@angular/core';
import { faBars, IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})

export class HeaderComponent implements OnInit, OnDestroy  {
  
  resizeObservable$ = new Subject();
  
  hasMenuToggled: boolean;
  faBars: IconDefinition;
  title: string;

  /*
   * If you are mutating data outside of the angular context (i.e., externally),
   * then angular will not know of the changes. You need to use ChangeDetectorRef
   * or NgZone in your component for making angular aware of external changes and
   * thereby triggering change detection.
  */
  constructor(private zone: NgZone) { }

  @HostListener('window:resize', ['$event.target'])
  onResize(target) {
    this.zone.run(()=> this.resizeObservable$.next(target.innerWidth));
  }

  ngOnInit(): void {
    this.title = 'gbastos';
    this.faBars = faBars;
    
    // Debounces the resize screen actions to not affect the performance of the browser,
    // as JavaScript is a single threaded language.
    this.resizeObservable$.pipe(debounceTime(50)).subscribe(
      res => {
        this.zone.run(() => this.onDetectScreenSize(res))
      }
    );

    // Executes the necessary adjustment based on screen properties
    this.onDetectScreenSize(window.innerWidth);
  }

  ngOnDestroy() {
    this.resizeObservable$.unsubscribe();
  }

  /*
   * For media types such as tablets and mobile devices, the nav-bar navigation should be
   * collapsed by default.
  */
  onDetectScreenSize(innerWidth) {
    this.hasMenuToggled = innerWidth > 1024;
  }

  onToggleBar() {
    this.hasMenuToggled = !this.hasMenuToggled;
  }

}
