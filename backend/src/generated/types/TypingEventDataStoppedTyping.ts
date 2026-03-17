import {TypingActionStoppedTyping} from './TypingActionStoppedTyping';
interface TypingEventDataStoppedTyping {
  userId: string;
  scheduleSlotId: string;
  action: TypingActionStoppedTyping;
  additionalProperties?: Map<string, any>;
}
export { TypingEventDataStoppedTyping };