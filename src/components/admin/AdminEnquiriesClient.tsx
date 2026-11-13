"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormField } from "@/components/shared/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { EnquiryStatus } from "@/generated/prisma/client";
import { formatDate } from "@/lib/dates";
import {
  adminReplyEnquiryAction,
  adminUpdateEnquiryAction,
} from "@/modules/enquiries/enquiry.actions";
import type { AdminEnquiryDTO } from "@/modules/enquiries/enquiry.service";

const STATUS_BADGE: Record<EnquiryStatus, "warning" | "primary" | "success"> = {
  NEW: "warning",
  IN_PROGRESS: "primary",
  RESOLVED: "success",
};

export function AdminEnquiriesClient({ enquiries }: { enquiries: AdminEnquiryDTO[] }) {
  const router = useRouter();
  const [replyTarget, setReplyTarget] = React.useState<AdminEnquiryDTO | null>(null);
  const [subject, setSubject] = React.useState("");
  const [replyMessage, setReplyMessage] = React.useState("");
  const [nextStatus, setNextStatus] = React.useState<"IN_PROGRESS" | "RESOLVED">("RESOLVED");
  const [noteDrafts, setNoteDrafts] = React.useState<Record<string, string>>({});
  const [statusDrafts, setStatusDrafts] = React.useState<Record<string, EnquiryStatus>>({});
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [sendingReply, setSendingReply] = React.useState(false);

  function openReplyModal(enq: AdminEnquiryDTO) {
    setReplyTarget(enq);
    setSubject(
      enq.productName
        ? `Regarding ${enq.productName} — Concierge Response`
        : `Your ${enq.type.toLowerCase()} concierge enquiry`,
    );
    setReplyMessage("");
    setNextStatus("RESOLVED");
  }

  async function handleSaveNoteAndStatus(enq: AdminEnquiryDTO) {
    setPendingId(enq.id);
    try {
      const nextSt = statusDrafts[enq.id] ?? enq.status;
      const nextNote = noteDrafts[enq.id] ?? enq.staffNote ?? "";
      const res = await adminUpdateEnquiryAction({
        enquiryId: enq.id,
        status: nextSt,
        staffNote: nextNote || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Enquiry record updated");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyTarget) return;
    setSendingReply(true);
    try {
      const res = await adminReplyEnquiryAction({
        enquiryId: replyTarget.id,
        subject,
        replyMessage,
        nextStatus,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(
        res.data.emailDelivered
          ? `Concierge reply sent to ${replyTarget.email}`
          : "Reply recorded (SMTP offline in local preview)",
      );
      setReplyTarget(null);
      router.refresh();
    } finally {
      setSendingReply(false);
    }
  }

  if (enquiries.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No client enquiries matching this filter"
        description="Bespoke commissions and product concierge enquiries submitted on the storefront appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {enquiries.map((enq) => {
        const currentStatus = statusDrafts[enq.id] ?? enq.status;
        const currentNote = noteDrafts[enq.id] ?? enq.staffNote ?? "";
        return (
          <article key={enq.id} className="rounded-md border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_BADGE[enq.status]}>{enq.status}</Badge>
                  <Badge variant="outline">{enq.type}</Badge>
                  <span className="font-display text-xl font-medium text-foreground">
                    {enq.name}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {enq.email}
                  {enq.phone ? ` · ${enq.phone}` : ""} · Received {formatDate(enq.createdAt)}
                </p>
                {enq.productName && enq.productId && (
                  <p className="mt-1 text-xs text-accent-text">
                    Referenced piece:{" "}
                    <Link
                      href={`/admin/products/${enq.productId}`}
                      className="underline underline-offset-4"
                    >
                      {enq.productName}
                    </Link>
                  </p>
                )}
              </div>

              <Button type="button" size="sm" onClick={() => openReplyModal(enq)}>
                <Send className="mr-1.5 size-3.5" aria-hidden="true" />
                Reply to Client
              </Button>
            </div>

            <p className="mt-3 text-sm whitespace-pre-wrap text-foreground">{enq.message}</p>

            <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <FormField id={`enq-status-${enq.id}`} label="Workflow Status">
                  {(fp) => (
                    <NativeSelect
                      {...fp}
                      value={currentStatus}
                      onChange={(e) =>
                        setStatusDrafts((prev) => ({
                          ...prev,
                          [enq.id]: e.target.value as EnquiryStatus,
                        }))
                      }
                    >
                      <option value="NEW">NEW</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="RESOLVED">RESOLVED</option>
                    </NativeSelect>
                  )}
                </FormField>
              </div>
              <div className="sm:col-span-6">
                <FormField id={`enq-note-${enq.id}`} label="Internal Concierge Notes">
                  {(fp) => (
                    <Textarea
                      {...fp}
                      rows={2}
                      value={currentNote}
                      onChange={(e) =>
                        setNoteDrafts((prev) => ({ ...prev, [enq.id]: e.target.value }))
                      }
                      placeholder="Record call outcomes, bespoke specs, or gem sourcing notes..."
                    />
                  )}
                </FormField>
              </div>
              <div className="flex items-end sm:col-span-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full px-3"
                  loading={pendingId === enq.id}
                  onClick={() => handleSaveNoteAndStatus(enq)}
                >
                  Save Note
                </Button>
              </div>
            </div>
          </article>
        );
      })}

      <Dialog
        open={Boolean(replyTarget)}
        onOpenChange={(open) => {
          if (!open) setReplyTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply to {replyTarget?.name}</DialogTitle>
            <DialogDescription>
              Sends an editorial concierge email to {replyTarget?.email} and logs the note on this
              enquiry.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendReply} className="space-y-4">
            <FormField id="reply-subject" label="Email Subject" required>
              {(fp) => (
                <Input
                  {...fp}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              )}
            </FormField>

            <FormField id="reply-message" label="Message" required>
              {(fp) => (
                <Textarea
                  {...fp}
                  rows={5}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Write a personal response from the gemology & concierge atelier..."
                  required
                />
              )}
            </FormField>

            <FormField id="reply-next-status" label="Set Status After Sending">
              {(fp) => (
                <NativeSelect
                  {...fp}
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value as "IN_PROGRESS" | "RESOLVED")}
                >
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                </NativeSelect>
              )}
            </FormField>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReplyTarget(null)}
                disabled={sendingReply}
              >
                Cancel
              </Button>
              <Button type="submit" loading={sendingReply}>
                Send Concierge Reply
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
