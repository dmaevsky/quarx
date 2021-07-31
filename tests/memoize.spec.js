const test = require('ava');
const { autorun, observable, memoizeOne, batch } = require('../dist/index');

let a, b, c, d
let sumABdidRecompute, sumCDdidRecompute, sumAllDidRecompute
let sumAB, sumCD, sumAll

function clearRecomputeFlags() {
  sumABdidRecompute = false
  sumCDdidRecompute = false
  sumAllDidRecompute = false
}

test.beforeEach(() => {
  a = observable.box(1, {name: 'a'});
  b = observable.box(2, {name: 'b'});
  c = observable.box(3, {name: 'c'});
  d = observable.box(4, {name: 'd'});

  clearRecomputeFlags()

  sumAB = memoizeOne(() => (sumABdidRecompute = true) && a.get() + b.get())
  sumCD = memoizeOne(() => (sumCDdidRecompute = true) && c.get() + d.get())
  sumAll = memoizeOne(() => (sumAllDidRecompute = true) && sumAB.get() + sumCD.get())
})

test('has a cache hit on second invocation', t => {
  const a = observable.box(3);
  let didRecompute = false
  const square = memoizeOne(() => (didRecompute = true) && a.get() * a.get())

  t.is(square.get(), 9)
  t.true(didRecompute)
  didRecompute = false
  t.is(square.get(), 9)
  t.false(didRecompute)
})

test('has a cache hit with nested memoized functions', t => {
    t.is(sumAll.get(), 10)
    t.true(sumABdidRecompute)
    t.true(sumCDdidRecompute)
    t.true(sumAllDidRecompute)

    // second invocation results in cache hit and does not compute sumAB and sumCD
    clearRecomputeFlags()
    t.is(sumAll.get(), 10)
    t.false(sumABdidRecompute)
    t.false(sumCDdidRecompute)
    t.false(sumAllDidRecompute)
  })

  test('invalidates parent memoize when nested box changes', t => {
    t.is(sumAll.get(), 10)

    a.set(5)

    clearRecomputeFlags()
    t.is(sumAll.get(), 14)

    t.true(sumABdidRecompute)
    t.false(sumCDdidRecompute)
    t.true(sumAllDidRecompute)
  })

  test.serial('autorun and batch still work', t => {
    let recomputeStats = []
    let actualSum = null
    autorun(() => {
      clearRecomputeFlags()
      actualSum = sumAll.get()
      recomputeStats.push([sumABdidRecompute, sumCDdidRecompute, sumAllDidRecompute])
    })

    t.is(actualSum, 10)
    t.is(recomputeStats.length, 1)
    t.deepEqual(recomputeStats.pop(), [true, true, true])

    a.set(5)
    t.is(actualSum, 14)
    t.is(recomputeStats.length, 1)
    t.deepEqual(recomputeStats.pop(), [true, false, true])

    batch(() => {
      a.set(-1)
      b.set(-2)
      c.set(-3)
      d.set(-4)
    })
    t.is(actualSum, -10)
    t.is(recomputeStats.length, 1)
    t.deepEqual(recomputeStats.pop(), [true, true, true])
  })
