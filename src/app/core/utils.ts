export function debounce(delay: number = 300): MethodDecorator {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const timeoutKey = Symbol();

        const original = descriptor.value;

        descriptor.value = function (...args) {
        clearTimeout(this[timeoutKey]);
        this[timeoutKey] = setTimeout(() => original.apply(this, args), delay);
        };

        return descriptor;
    };
}