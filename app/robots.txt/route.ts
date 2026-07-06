import { geo } from "@/lib/geo";

export function GET(): Response {
  return new Response(geo.robotsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
