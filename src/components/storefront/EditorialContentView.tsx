import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container, Section } from "@/components/shared/primitives";
import { getEditorialContentPage } from "@/lib/content";
import { buildBreadcrumbListJsonLd } from "@/lib/seo/jsonld";

export async function EditorialContentView({ slug }: { slug: string }) {
  const page = await getEditorialContentPage(slug);

  return (
    <Section spacing="md">
      <JsonLd
        data={buildBreadcrumbListJsonLd([
          { name: "Home", path: "/" },
          { name: page.title, path: `/${page.slug}` },
        ])}
      />
      <Container>
        <div className="mx-auto max-w-3xl">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: page.title }]} />

          <header className="mt-4 border-b border-border pb-6">
            <p className="font-sans text-editorial-label text-accent-text">{page.eyebrow}</p>
            <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
              {page.title}
            </h1>
            {page.description && (
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                {page.description}
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Last updated: {page.updatedAt}</p>
          </header>

          <article
            className="editorial-prose mt-8 space-y-5 text-sm leading-7 text-foreground/90 sm:text-base [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-medium [&_h3]:text-foreground [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-sm [&_td]:border-b [&_td]:border-border [&_td]:py-2.5 [&_td]:pr-4 [&_th]:border-b [&_th]:border-border [&_th]:py-2.5 [&_th]:pr-4 [&_th]:font-medium [&_th]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: page.html }}
          />
        </div>
      </Container>
    </Section>
  );
}
