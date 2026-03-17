
interface GroupInvitationEventData {
  groupId: string;
  familyId: string;
  inviteCode?: string;
  invitedBy?: string;
  expiresAt?: number;
  additionalProperties?: Map<string, any>;
}
export type { GroupInvitationEventData };
