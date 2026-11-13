import Link from "next/link";
import { FadeIn } from "@/components/motion/Reveal";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

interface AuthCardProps {
  eyebrow?: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthCard({
  eyebrow: _eyebrow,
  title,
  description,
  children,
  footer,
}: AuthCardProps) {
  void _eyebrow;
  return (
    <FadeIn className="w-full max-w-md">
      <Card className="w-full rounded-xl border-border bg-card shadow-card">
        <CardHeader className="space-y-2 pb-4">
          <h1 className="type-h2 font-semibold text-foreground">{title}</h1>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {children}
          {footer && (
            <div className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}

export function AuthHelpLink({
  href,
  children,
  inline = false,
}: {
  href: string;
  children: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        inline
          ? "font-medium text-accent-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-foreground/45"
          : "inline-flex min-h-11 items-center rounded-sm px-1 font-medium text-accent-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-foreground/45"
      }
    >
      {children}
    </Link>
  );
}
