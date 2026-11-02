// The MilliNet 2026 badge. The contest rules require it on the home page, or
// the entry can be excluded.
//
// To fill it in: millinet.az → your account → your project → "Kod" button →
// copy the code and paste it between the backticks below, exactly as given.
// If the site's JavaScript version doesn't show up, use the plain HTML code
// from the bottom of the same "Kod" window instead.
//
// You can also set it on Vercel without editing code: add an environment
// variable NEXT_PUBLIC_MILLINET_BADGE with the code as its value, then redeploy.
export const MILLINET_BADGE_HTML: string = `
`.trim();

export function badgeHtml(): string {
  return (process.env.NEXT_PUBLIC_MILLINET_BADGE || MILLINET_BADGE_HTML).trim();
}
