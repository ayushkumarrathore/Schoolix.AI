
export type Role = 'bot' | 'user';

export interface Message {
  role: Role;
  text: string;
  timestamp: Date;
}

export interface VerificationState {
  currentStep: number;
  userName?: string;
  admissionNo?: string;
  rollNo?: string;
  intent?: string;
  isComplete: boolean;
  isDenied: boolean;
}

export enum Step {
  INITIAL = 0,
  NAME_SECTION = 1,
  ADMISSION_NO = 2,
  ROLL_NO = 3,
  INTENT = 4,
  FINISHED = 5
}
