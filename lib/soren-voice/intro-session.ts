type IntroListener = () => void;

let introDone = false;
const introListeners = new Set<IntroListener>();

export function resetIntroSession(): void {
  introDone = false;
}

export function markIntroDone(): void {
  if (introDone) return;
  introDone = true;
  introListeners.forEach((listener) => listener());
}

export function isIntroDone(): boolean {
  return introDone;
}

export function onIntroDone(listener: IntroListener): () => void {
  if (introDone) listener();
  introListeners.add(listener);
  return () => {
    introListeners.delete(listener);
  };
}
