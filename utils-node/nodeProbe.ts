import net from "node:net";
import type { ProbePort } from "./types.ts";

/** `ProbePort` over a TCP connect to `127.0.0.1`. */
export function nodeProbe(): ProbePort {
  return {
    isListening: (port, timeoutMs) =>
      new Promise((resolve) => {
        const socket = new net.Socket();
        const done = (listening: boolean) => {
          socket.destroy();
          resolve(listening);
        };
        socket.setTimeout(timeoutMs);
        socket.once("connect", () => done(true));
        socket.once("error", () => done(false));
        socket.once("timeout", () => done(false));
        socket.connect(port, "127.0.0.1");
      }),
  };
}
