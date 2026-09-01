"use client";

import { useActionState, useTransition } from "react";
import type { AlbumMember, Role } from "@/lib/albums/types";
import { CAN_MANAGE_MEMBERS } from "@/lib/albums/types";
import {
  changeMemberRole,
  inviteMember,
  leaveAlbum,
  removeMember,
  type ActionState,
} from "@/lib/albums/actions";

const initialState: ActionState = { error: null };
const ASSIGNABLE_ROLES: Role[] = ["admin", "editor", "viewer"];

export default function ManageMembers({
  albumId,
  members,
  myRole,
  myUserId,
}: {
  albumId: string;
  members: AlbumMember[];
  myRole: Role;
  myUserId: string;
}) {
  const canManage = CAN_MANAGE_MEMBERS.includes(myRole);
  const boundInvite = inviteMember.bind(null, albumId);
  const [inviteState, inviteAction, invitePending] = useActionState(
    boundInvite,
    initialState,
  );
  const [, startTransition] = useTransition();

  return (
    <section className="mb-8">
      <h2 className="text-sm font-mono uppercase tracking-wide text-text-muted mb-3">
        Members
      </h2>
      <ul className="mb-3 flex flex-col divide-y divide-border overflow-hidden rounded-md border border-border">
        {members.map((member) => (
          <li
            key={member.userId}
            className="flex items-center justify-between gap-3 bg-surface px-4 py-2.5"
          >
            <span className="truncate text-sm text-text">{member.email}</span>
            <div className="flex shrink-0 items-center gap-3">
              {canManage && member.role !== "owner" ? (
                <select
                  defaultValue={member.role}
                  aria-label={`Role for ${member.email}`}
                  onChange={(e) =>
                    startTransition(() =>
                      changeMemberRole(albumId, member.userId, e.target.value as Role),
                    )
                  }
                  className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs uppercase text-text-muted outline-none focus:border-accent"
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-mono text-[10px] uppercase text-accent">
                  {member.role}
                </span>
              )}
              {canManage && member.role !== "owner" && member.userId !== myUserId && (
                <button
                  type="button"
                  onClick={() => startTransition(() => removeMember(albumId, member.userId))}
                  className="text-xs text-text-faint hover:text-danger transition-colors"
                >
                  Remove
                </button>
              )}
              {member.userId === myUserId && myRole !== "owner" && (
                <button
                  type="button"
                  onClick={() => startTransition(() => leaveAlbum(albumId))}
                  className="text-xs text-text-faint hover:text-danger transition-colors"
                >
                  Leave
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {canManage && (
        <form action={inviteAction} className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            name="email"
            required
            placeholder="Invite by email"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
          <select
            name="role"
            defaultValue="viewer"
            aria-label="Role for new member"
            className="rounded-md border border-border bg-surface px-2 py-2 text-sm text-text outline-none focus:border-accent"
          >
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={invitePending}
            className="rounded-md border border-border px-4 py-2 text-sm text-text hover:bg-surface-sunken transition-colors disabled:opacity-60"
          >
            {invitePending ? "Inviting…" : "Invite"}
          </button>
          {inviteState.error && (
            <p className="w-full text-sm text-danger" role="alert">
              {inviteState.error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
