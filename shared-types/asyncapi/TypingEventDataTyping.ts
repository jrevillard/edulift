import {TypingActionTyping} from './TypingActionTyping';
interface TypingEventDataTyping {
  userId: string;
  scheduleSlotId: string;
  action: TypingActionTyping;
  additionalProperties?: Map<string, any>;
}
export type { TypingEventDataTyping };
