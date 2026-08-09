/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runAndPersistRadar } from "../lib/soccerverse-radar";
import { settlePublishedSpotlights } from "../lib/soccerverse-match";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const PRIVATE_API_PREFIXES = ["/api/admin/", "/api/predictions", "/api/profile", "/api/season"];

function secureResponse(response: Response, url: URL) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", "base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'");
  headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  if (url.protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000");
  }
  if (PRIVATE_API_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix))) {
    headers.set("Cache-Control", "private, no-store");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    let response: Response;

    if (url.pathname.startsWith("/api/")) {
      response = Response.json(
        { error: "The Under the Lights beta has ended." },
        { status: 410, headers: { "Cache-Control": "private, no-store" } },
      );
      return secureResponse(response, url);
    }

    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/") || url.pathname.startsWith("/players/")) {
      response = Response.redirect(new URL("/", url), 307);
      return secureResponse(response, url);
    }

    if (url.pathname === "/_vinext/image") {
      const images = env.IMAGES;
      if (!images) {
        const source = url.searchParams.get("url");
        response = source
          ? await env.ASSETS.fetch(new Request(new URL(source, request.url)))
          : new Response("Missing image URL", { status: 400 });
        return secureResponse(response, url);
      }

      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await images.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return secureResponse(response, url);
    }

    response = await handler.fetch(request, env, ctx);
    return secureResponse(response, url);
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (controller.cron === "0 7 * * 1") {
      ctx.waitUntil(runAndPersistRadar(env.DB, "system:monday-radar", new Date(controller.scheduledTime)));
      return;
    }
    ctx.waitUntil(settlePublishedSpotlights(env.DB, controller.scheduledTime));
  },
};

export default worker;
