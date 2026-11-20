/* Runs Argon2id off the main thread so the UI keeps responding while unlocking (docs/ARCHITECTURE.md §2.1). */
import { deriveKeyDirect, type Argon2Params } from './kdf';

interface Request {
  id: number;
  password: string;
  salt: Uint8Array;
  params: Argon2Params;
}

const scope = self as unknown as {
  addEventListener(type: 'message', listener: (event: MessageEvent<Request>) => void): void;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

scope.addEventListener('message', (event) => {
  const { id, password, salt, params } = event.data;
  deriveKeyDirect(password, salt, params).then(
    (key) => scope.postMessage({ id, key }, [key.buffer]),
    (err: unknown) => scope.postMessage({ id, error: err instanceof Error ? err.message : String(err) }),
  );
});
