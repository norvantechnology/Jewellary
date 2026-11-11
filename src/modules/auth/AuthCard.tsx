import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

interface AuthCardProps {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthCard({ eyebrow, title, description, children, footer }: AuthCardProps) {
  return (
    <Card className="w-full max-w-md border-border bg-card shadow-card">
      <CardHeader className="space-y-2 pb-4">
        <p className="text-editorial-label text-accent-text">{eyebrow}</p>
        <h1 className="font-display text-3xl font-medium tracking-tight text-foreground">
          {title}
        </h1>
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
  );
}

export function AuthHelpLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-accent-text underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
