import test from 'ava';
import { autorun, observable, computed } from '../index';

const computedLogged = log => (name, computation) => computed(() => {
  log.push(`computing ${name}`);

  const result = computation();

  log.push(`${name} = ${result}`);
  return result;
}, { name });

test('discovering a new dependency path, only recalculating what is needed along it', t => {
  const log = [];
  const calc = computedLogged(log);

  const A = observable.box(0);
  const B = calc('B', () => A.get() ? D.get() : 555);
  const C = calc('C', () => A.get() >= 0 ? 1 : -1);
  const D = calc('D', () => C.get() * 42);

  autorun(() => {
    log.push(`autorun: B = ${B.get()}`);
    log.push(`autorun: D = ${D.get()}`);
  });

  log.push('===');
  A.set(1);

  t.deepEqual(log, [
    'computing B',
    'B = 555',
    'autorun: B = 555',
    'computing D',
    'computing C',
    'C = 1',
    'D = 42',
    'autorun: D = 42',
    '===',
    'computing B',
    'computing C',
    'C = 1',
    'B = 42',
    'autorun: B = 42',
    'autorun: D = 42'
  ]);
});
