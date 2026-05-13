export async function register(): Promise<void> {
  // Only instrument the Node.js server runtime, not the Edge or browser runtimes.
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    const { init } = await import("@syskoio/core");
    await init({
      serviceName: "example-nextjs",
      redact: {
        queryParams: ["token", "apiKey"],
      },
    });
  }
}
