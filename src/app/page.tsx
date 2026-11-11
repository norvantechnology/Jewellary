export default function HomePage() {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "Maison Aurelia";
  return (
    <main>
      <h1>{siteName}</h1>
      <p>Fine Diamonds &amp; Bespoke Jewellery</p>
    </main>
  );
}
