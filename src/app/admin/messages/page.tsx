import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminMessagesClient } from "@/components/admin/AdminMessagesClient";
import { listAdminConversations, listCannedReplies } from "@/modules/chat/chat.service";
import { hasPermission } from "@/lib/permissions";
import { requireStaffPageSession } from "@/server/dal";

export const metadata: Metadata = {
  title: "Concierge Messages",
};

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireStaffPageSession("/admin/messages");
  if (!session || !hasPermission(session.user.role, "chat:manage")) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const initialConversationId = typeof sp.id === "string" ? sp.id : null;

  const [inboxData, cannedReplies] = await Promise.all([
    listAdminConversations(
      {
        status: "OPEN",
        assignedToId: "ALL",
        contextType: "ALL",
        unreadOnly: false,
        page: 1,
        limit: 40,
      },
      session.user.id,
    ),
    listCannedReplies(true),
  ]);

  return (
    <AdminMessagesClient
      initialConversations={inboxData.items}
      initialTotalUnread={inboxData.totalUnreadCount}
      staffMembers={inboxData.staffMembers}
      initialCannedReplies={cannedReplies}
      currentUserId={session.user.id}
      initialConversationId={initialConversationId}
    />
  );
}
