import { UiText } from "@/components/shared/UiText";
import { EditorialToc } from "@/components/motion/EditorialToc";
import { Reveal } from "@/components/motion/Reveal";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container, Section } from "@/components/shared/primitives";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getEditorialContentPage } from "@/lib/content";
import { extractFaqGroups, injectHeadingIdsAndExtractToc } from "@/lib/editorial-toc";
import { buildBreadcrumbListJsonLd, buildFaqPageJsonLd } from "@/lib/seo/jsonld";

const PROSE_CLASS =
  "editorial-prose mt-8 space-y-5 text-foreground/90 [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:text-2xl [&_h2]:leading-[1.2] [&_h2]:font-semibold [&_h2]:tracking-[-0.015em] [&_h2]:text-foreground [&_h3]:mt-7 [&_h3]:text-xl [&_h3]:leading-[1.25] [&_h3]:font-semibold [&_h3]:text-foreground [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_table]:block [&_table]:max-w-full [&_table]:border-collapse [&_table]:overflow-x-auto [&_table]:text-left [&_table]:text-sm [&_td]:border-b [&_td]:border-border [&_td]:py-2.5 [&_td]:pr-4 [&_th]:border-b [&_th]:border-border [&_th]:py-2.5 [&_th]:pr-4 [&_th]:font-semibold [&_th]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5";

export async function EditorialContentView({ slug }: { slug: string }) {
  const page = await getEditorialContentPage(slug);
  const faqData = slug === "faq" ? extractFaqGroups(page.html) : null;
  const isFaqAccordion = Boolean(faqData && faqData.groups.length > 0);
  const faqSchema =
    isFaqAccordion && faqData
      ? buildFaqPageJsonLd(
          faqData.groups.flatMap((group) =>
            group.items.map((item) => ({
              question: item.question,
              answer: item.answerHtml,
            })),
          ),
        )
      : null;
  const { html: htmlWithIds, toc } = isFaqAccordion
    ? { html: page.html, toc: [] }
    : injectHeadingIdsAndExtractToc(page.html);
  const showToc = toc.length >= 2;

  return (
    <Section spacing="sm">
      <JsonLd
        data={buildBreadcrumbListJsonLd([
          { name: "Home", path: "/" },
          { name: page.title, path: `/${page.slug}` },
        ])}
      />
      {faqSchema && <JsonLd data={faqSchema} />}
      <Container variant={showToc ? "default" : "prose"}>
        <div className={showToc ? "mx-auto max-w-[1020px]" : "w-full"}>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: page.title }]} />

          <div
            className={
              showToc
                ? "mt-4 grid gap-10 lg:grid-cols-[minmax(0,720px)_220px] lg:items-start lg:justify-between"
                : "mt-4"
            }
          >
            <div className="max-w-[760px] min-w-0">
              <header className="border-b border-border pb-6">
                <h1 className="type-h1 font-semibold break-words text-foreground">{page.title}</h1>
                {page.description && (
                  <p className="prose-limit mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
                    {page.description}
                  </p>
                )}
              </header>

              {isFaqAccordion && faqData ? (
                <div className="mt-8 space-y-10">
                  {faqData.introHtml && (
                    <div
                      className="editorial-prose text-foreground/90"
                      dangerouslySetInnerHTML={{ __html: faqData.introHtml }}
                    />
                  )}

                  {faqData.groups.map((group) => (
                    <section key={group.id} aria-labelledby={group.id} className="space-y-3">
                      <Reveal>
                        <h2
                          id={group.id}
                          className="type-h2 font-display font-semibold tracking-tight text-foreground"
                        >
                          {group.heading}
                        </h2>
                      </Reveal>
                      <Accordion
                        type="multiple"
                        className="rounded-xl border border-border bg-card px-4 sm:px-5"
                      >
                        {group.items.map((item, idx) => (
                          <AccordionItem
                            key={item.id}
                            value={item.id}
                            className={idx === group.items.length - 1 ? "border-b-0" : undefined}
                          >
                            <AccordionTrigger className="min-h-14 py-4 text-left text-base font-medium text-foreground">
                              {item.question}
                            </AccordionTrigger>
                            <AccordionContent className="pb-4">
                              <div
                                className="space-y-3 text-base leading-[1.7] text-muted-foreground [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-4"
                                dangerouslySetInnerHTML={{ __html: item.answerHtml }}
                              />
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </section>
                  ))}
                </div>
              ) : (
                <article
                  className={PROSE_CLASS}
                  dangerouslySetInnerHTML={{ __html: htmlWithIds }}
                />
              )}
            </div>

            {showToc && (
              <aside
                aria-labelledby="editorial-toc-heading"
                className="hidden lg:sticky lg:top-24 lg:block"
              >
                <p
                  id="editorial-toc-heading"
                  className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                >
                  <UiText section="common" name="onThisPage" />
                </p>
                <EditorialToc entries={toc} />
              </aside>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
