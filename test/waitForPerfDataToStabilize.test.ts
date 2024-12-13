import { waitForPerfDataToStabilize } from '../src/helpers/waitForPerfDataToStabilize';

type GetPattern = 'constant' | 'random' | 'unstableToStable';

function* contentGenerator(genPattern: GetPattern = 'unstableToStable') {
  let contents = [
    'initial',
    'changing',
    'initial',
    'changing',
    'initial',
    'changing',
    'initial',
    'changing',
    ...Array(10).fill('stable')
  ];
  switch (genPattern) {
    case 'constant':
      contents = ['stable'];
      break;
    case 'random':
      contents = Array(10)
        .fill('x')
        .map(() => Math.random().toString(36).substring(7));
    case 'unstableToStable':
    default:
      break;
  }
  let index = 0;
  while (true) {
    yield contents[index % contents.length];
    index++;
  }
}

function createFetchContent(genPattern: GetPattern): () => string {
  const generator = contentGenerator(genPattern);
  return () => {
    const content = generator.next();
    if (!content.done) {
      return content.value;
    }
  };
}
describe('waitForPerfDataToStabilize', () => {
  it('should resolve when content stabilizes within the timeout', async () => {
    const stable = await waitForPerfDataToStabilize(500, 10, createFetchContent('unstableToStable'));

    expect(stable).toBe(true);
  });

  it('should return false when not stable with timeout', async () => {
    const stable = await waitForPerfDataToStabilize(500, 10, createFetchContent('random'));

    expect(stable).toBe(false);
  });

  it('should resolve immediately if content is already stable', async () => {
    const stable = await waitForPerfDataToStabilize(500, 10, createFetchContent('constant'));

    expect(stable).toBe(true);
  });
});
