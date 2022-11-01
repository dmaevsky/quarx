type ObservableOptions<T> = {
  name?: string;
  equals?: (a: T, b: T) => boolean;
}

type Disposer = () => void;

type Atom = {
  reportObserved: () => boolean;
  reportChanged: () => void;
}

type CoreOptions = {
  name?: string;
  onError?: () => void;
}

type Observable<T> = {
  get: () => T;
}

type Box<T> = Observable<T> & {
  set: (value: T) => void;
}

type Subscribable<R> = {
  subscribe: (subscriber: (result: R) => void, onError?: (error: any) => void, onStale?: (flow: unknown) => void) => () => void;
}

declare module 'quarx' {
  export function createAtom(onBecomeObserved?: () => Disposer | void, options?: CoreOptions): Atom;
  export function autorun(computation: () => void, options?: CoreOptions): Disposer;

  export function batch(changes: () => void): void;

  export function untrack<F extends Function>(fn: F): F
  export function untracked<T>(fn: () => T): T;
}

declare module 'quarx/box' {
  export function box<T>(value: T, options?: ObservableOptions<T>): Box<T>;
}

declare module 'quarx/computed' {
  export function computed<T>(computation: () => T, options?: ObservableOptions<T>): Observable<T>;
}

declare module 'quarx/map' {
  export function observableMap<K, V>(underlyingMap?: Map<K, V>, options?: ObservableOptions<V>): Map<K, V>;
}

declare module 'quarx/adapters' {
  export function subscribable<R>(computation: () => R, options?: CoreOptions): Subscribable<R>;
  export function toObservable<R>(subs: Subscribable<R>, options?: ObservableOptions<R>): Observable<R>;
}
