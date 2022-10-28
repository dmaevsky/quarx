import test from 'ava';
import { autorun } from '../src/core.js';
import { box } from '../src/box.js';
import { computed } from '../src/computed.js';

function gc() {
  if (typeof global.gc === "function") {
    console.log('GC...')
    global.gc()
  }
}

function now() {
  return +new Date()
}

const log = console.log;

test.serial(`one observes ten thousand that observe one`, function (t) {
  gc()
  const a = box(2);

  // many observers that listen to one..
  const observers = []
  for (let i = 0; i < 10000; i++) {
      ;(function (idx) {
          observers.push(
              computed(function () {
                  return a.get() * idx
              })
          )
      })(i)
  }

  let bCalcs = 0
  // one observers that listens to many..
  const b = computed(function () {
      let res = 0
      for (let i = 0; i < observers.length; i++) res += observers[i].get()
      bCalcs += 1
      return res
  })

  const start = now()

  autorun(() => {
    const bVal = b.get();
    t.is(49995000 * (bCalcs + 1), bVal);
  });

  const initial = now()

  a.set(3)
  t.is(2, bCalcs);
  const end = now()

  log(
      "One observers many observes one - Started/Updated in " +
          (initial - start) +
          "/" +
          (end - initial) +
          " ms."
  )
});

test.serial(`five hundrend properties that observe their sibling`, function (t) {
  gc()
  let n = 500;
  const observables = [box(1)]
  for (let i = 0; i < n; i++) {
      ;(function (idx) {
          observables.push(
              computed(function () {
                  return observables[idx].get() + 1
              })
          )
      })(i)
  }

  const start = now()

  const last = observables[observables.length - 1]

  let first = 1;

  autorun(() => {
    t.is(n + first++, last.get());
  })

  const initial = now()

  observables[0].set(2)
  const end = now()

  log(
      `${n} props observing sibling -  Started/Updated in ` +
          (initial - start) +
          "/" +
          (end - initial) +
          " ms."
  )
});

test.serial(`late dependency change`, function (t) {
  gc()
  const values = []
  for (let i = 0; i < 100; i++) values.push(box(0))

  const sum = computed(function () {
      let sum = 0
      for (let i = 0; i < 100; i++) sum += values[i].get()
      return sum
  })

  autorun(() => sum.get());

  const start = new Date()

  for (let i = 0; i < 10000; i++) values[99].set(i)

  t.is(sum.get(), 9999)
  log("Late dependency change - Updated in " + (new Date() - start) + "ms.")
})

test.serial(`array reduce`, function (t) {
  gc()
  let aCalc = 0
  const ar = box([])
  const b = box(1)

  const sum = computed(function () {
      aCalc++
      return ar.get().reduce(function (a, c) {
          return a + c * b.get()
      }, 0)
  })

  let sumValue;

  autorun(() => sumValue = sum.get());

  const start = now()

  for (let i = 0; i < 1000; i++) ar.set([...ar.get(), i])

  t.is(499500, sumValue)
  t.is(1001, aCalc)
  aCalc = 0

  const initial = now()

  for (let i = 0; i < 1000; i++) ar.set(Object.assign([...ar.get()], { [i]: ar.get()[i] * 2 }))
  b.set(2)

  t.is(1998000, sumValue)
  t.is(1001, aCalc)

  const end = now()

  log(
      "Array reduce -  Started/Updated in " +
          (initial - start) +
          "/" +
          (end - initial) +
          " ms."
  )
})

test.serial(`array classic loop`, function (t) {
  gc()
  const ar = []
  const len = box(0)
  let aCalc = 0
  const b = box(1)
  const sum = computed(function () {
      let s = 0
      aCalc++
      for (let i = 0; i < ar.length; i++) s += ar[i].get() * b.get()
      return len.get() && s
  })

  let sumValue;
  autorun(() => sumValue = sum.get());

  const start = now()

  t.is(1, aCalc)
  for (let i = 0; i < 1000; i++) len.set(ar.push(box(i)))

  t.is(499500, sumValue)
  t.is(1001, aCalc)

  const initial = now()
  aCalc = 0

  for (let i = 0; i < 1000; i++) ar[i].set(ar[i].get() * 2)
  b.set(2)

  t.is(1998000, sumValue)
  t.is(1000, aCalc)

  const end = now()

  log(
      "Array loop -  Started/Updated in " + (initial - start) + "/" + (end - initial) + " ms."
  )
})
