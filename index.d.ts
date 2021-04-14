declare module 'quarx' {
  type Disposer = () => void;

  export interface Atom {
    reportObserved: () => boolean;
    reportChanged: () => void;
  }

  export function createAtom(name?: string, onBecomeObserved?: () => Disposer | void): Atom;
  export function autorun(computation: () => void): Disposer;

  export interface Observable<T> {
    get: () => T;
  }

  export interface Box<T> extends Observable<T> {
    set: (value: T) => void;
  }

  export interface ObservableOptions<T> {
    name?: string;
    equal?: (a: T, b: T) => boolean;
  }

  export namespace observable {
    export function box<T>(value: T, options?: ObservableOptions<T>): Box<T>;
  }

  export function computed<T>(computation: () => T, options?: ObservableOptions<T>): Observable<T>;
}
