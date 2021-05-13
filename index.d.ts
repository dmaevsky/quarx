declare module 'quarx' {
  type Disposer = () => void;

  export interface Atom {
    reportObserved: () => boolean;
    reportChanged: () => void;
  }

  export interface CoreOptions {
    name?: string;
    onError?: () => void;
  }

  export function createAtom(onBecomeObserved?: () => Disposer | void, options?: CoreOptions): Atom;
  export function autorun(computation: () => void, options?: CoreOptions): Disposer;

  export function batch(changes: () => void): void;
  export function untracked<T>(fn: () => T): T;

  export interface Observable<T> {
    get: () => T;
  }

  export interface Box<T> extends Observable<T> {
    set: (value: T) => void;
  }

  export interface ObservableOptions<T> {
    name?: string;
    equals?: (a: T, b: T) => boolean;
  }

  export namespace observable {
    export function box<T>(value: T, options?: ObservableOptions<T>): Box<T>;
  }

  export function computed<T>(computation: () => T, options?: ObservableOptions<T>): Observable<T>;
}
