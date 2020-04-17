import { TypingAnimationOptions } from './typingAnimationOptions.interface';

export class Typed {

    element: any;
    options: TypingAnimationOptions;
    phrases: string[];
    timeout: any;
    isDeleting: boolean;
    loopNum: number;
    text: string;

    constructor(element: any, options: TypingAnimationOptions, phrases: string[]) {
        const defaults: TypingAnimationOptions = {
            typeSpeed: 250,
            startDelay: 2000,
            phrasePeriod: 200
        }
        
        this.text = '';
        this.isDeleting = false;
        this.loopNum = 0;
        this.element = element
        this.options = {...defaults, ...options}
        this.phrases = phrases;
        this.appendAnimationCss()
    }

    public begin () {
        this.timeout = setTimeout(() => {
            this.typewrite()
        }, this.options.startDelay)
    }

    private insertSpan (text: string) {
        this.element.innerHTML = '<span class="wrap">'+text+'</span>';
    }


    private typewrite() {
        let i = this.loopNum % this.phrases.length;
        let fullTxt = this.phrases[i];

        if (this.isDeleting) {
            this.text = fullTxt.substring(0, this.text.length - 1);
        } else {
            this.text = fullTxt.substring(0, this.text.length + 1);
        }

        this.insertSpan(this.text);

        let that = this;
        let delta = this.options.typeSpeed - Math.random() * 100;

        if (this.isDeleting) { delta /= 2; }

        if (!this.isDeleting && this.text === fullTxt) {
            delta = this.options.phrasePeriod;
            this.isDeleting = true;
        } else if (this.isDeleting && this.text === '') {
            this.isDeleting = false;
            this.loopNum++;
            delta = 500;
        }

        setTimeout(function() {
            that.typewrite();
        }, delta);
    }

    private appendAnimationCss () {
        let css = document.createElement('style');
        css.type = 'text/css';
        css.id = 'typing';

        const innerCss = `
            .txt-rotate > .wrap::after {
                content: "|";
                opacity: 1;
                animation: typedBlink 0.7s infinite;
                -webkit-animation: typedBlink 0.7s infinite;
                animation: typedBlink 0.7s infinite;
            }
            @keyframes typedBlink{
                50% { opacity: 0.0; }
            }
            @-webkit-keyframes typedBlink{
                0% { opacity: 1; }
                50% { opacity: 0.0; }
                100% { opacity: 1; }
            }
        `;

        css.innerHTML = innerCss;
        document.head.appendChild(css);
    }
}