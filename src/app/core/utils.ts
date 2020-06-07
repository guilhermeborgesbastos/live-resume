export function debounce(delay: number = 300): MethodDecorator {

    let interval;
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const original = descriptor.value;
        descriptor.value = function (...args) {
        clearTimeout(interval);

        interval = setTimeout(() => {
            interval = null;
            original.apply(this, args);
          }, delay);
        };

        return interval;
    };
}