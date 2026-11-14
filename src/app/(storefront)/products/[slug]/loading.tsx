import { Container, Section } from "@/components/shared/primitives";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function Loading() {
  return (
    <Section spacing="md" className="pt-8 pb-10 sm:pt-10">
      <Container>
        <PageSkeleton label="Loading product" variant="detail" />
      </Container>
    </Section>
  );
}
