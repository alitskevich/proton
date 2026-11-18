import { describe, expect, it } from "bun:test";
import net from "node:net";
import { nodeProbe } from "./nodeProbe.ts";

describe("nodeProbe", () => {
  it("is true for a listening port and false for a closed one", async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as net.AddressInfo;
    const probe = nodeProbe();
    expect(await probe.isListening(port, 400)).toBe(true);
    await new Promise((resolve) => server.close(resolve));
    expect(await probe.isListening(port, 400)).toBe(false);
  });
});
